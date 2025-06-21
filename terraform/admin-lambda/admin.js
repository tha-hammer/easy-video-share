const { DynamoDBClient } = require("@aws-sdk/client-dynamodb");
const { DynamoDBDocumentClient, QueryCommand, ScanCommand, DeleteCommand } = require("@aws-sdk/lib-dynamodb");
const { CognitoIdentityProviderClient, ListUsersCommand, AdminGetUserCommand, AdminDeleteUserCommand, AdminAddUserToGroupCommand, AdminRemoveUserFromGroupCommand, AdminListGroupsForUserCommand } = require("@aws-sdk/client-cognito-identity-provider");
const { S3Client, DeleteObjectCommand } = require("@aws-sdk/client-s3");

const dynamoClient = new DynamoDBClient({ region: process.env.AWS_REGION });
const docClient = DynamoDBDocumentClient.from(dynamoClient);
const cognitoClient = new CognitoIdentityProviderClient({ region: process.env.AWS_REGION });
const s3Client = new S3Client({ region: process.env.AWS_REGION });

const tableName = process.env.DYNAMODB_TABLE;
const userPoolId = process.env.COGNITO_USER_POOL_ID;
const corsOrigin = process.env.CORS_ORIGIN || "*";

// CORS headers
const corsHeaders = {
  "Access-Control-Allow-Origin": corsOrigin,
  "Access-Control-Allow-Methods": "GET, POST, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, X-Amz-Date, Authorization, X-Api-Key, X-Amz-Security-Token"
};

// Response helper
const createResponse = (statusCode, body) => ({
  statusCode,
  headers: corsHeaders,
  body: JSON.stringify(body)
});

// Check if user is admin
const isAdmin = async (username, userId = null) => {
  try {
    const command = new AdminListGroupsForUserCommand({
      UserPoolId: userPoolId,
      Username: username // Use the actual username, not the sub UUID
    });
    
    const result = await cognitoClient.send(command);
    const groups = result.Groups || [];
    
    console.log(`Admin check for user ${username}:`, groups.map(g => g.GroupName));
    return groups.some(group => group.GroupName === 'admin');
  } catch (error) {
    console.error('Error checking admin status for user:', username, error);
    return false;
  }
};

exports.handler = async (event) => {
  console.log("Admin API Event:", JSON.stringify(event, null, 2));

  try {
    const httpMethod = event.httpMethod;
    const path = event.path;
    
    // Handle CORS preflight
    if (httpMethod === "OPTIONS") {
      return createResponse(200, { message: "CORS preflight" });
    }

    // Extract user info from Cognito JWT token
    let userId = null;
    let userEmail = null;
    let username = null;
    
    if (event.requestContext && event.requestContext.authorizer) {
      const claims = event.requestContext.authorizer.claims;
      if (claims) {
        userId = claims.sub;
        userEmail = claims.email;
        username = claims['cognito:username']; // This is the actual username used in Cognito
        console.log("Authenticated user:", { userId, userEmail, username });
      }
    }

    if (!userId || !username) {
      return createResponse(401, {
        error: "Authentication required"
      });
    }

    // Check if user is admin using the username (not userId)
    const adminStatus = await isAdmin(username, userId);
    if (!adminStatus) {
      return createResponse(403, {
        error: "Admin access required"
      });
    }

    console.log("Admin access confirmed for user:", userId);

    // Route to appropriate handler based on path and method
    if (path === "/admin/users" && httpMethod === "GET") {
      return await handleListUsers();
    }
    
    if (path === "/admin/videos" && httpMethod === "GET") {
      return await handleListAllVideos();
    }
    
    if (path === "/admin/videos" && httpMethod === "DELETE") {
      return await handleDeleteVideo(event);
    }
    
    if (path.match(/^\/admin\/users\/[^\/]+\/videos$/) && httpMethod === "GET") {
      const userIdFromPath = path.split('/')[3];
      return await handleListUserVideos(userIdFromPath);
    }

    // Method/path not found
    return createResponse(404, {
      error: `Method ${httpMethod} ${path} not found`
    });

  } catch (error) {
    console.error("Admin API Error:", error);
    
    return createResponse(500, {
      error: "Internal server error",
      message: error.message,
      ...(process.env.NODE_ENV === "development" && { stack: error.stack })
    });
  }
};

// Handler functions
async function handleListUsers() {
  try {
    const command = new ListUsersCommand({
      UserPoolId: userPoolId,
      Limit: 60
    });
    
    const result = await cognitoClient.send(command);
    const users = result.Users || [];
    
    // Transform users for frontend
    const transformedUsers = users.map(user => {
      const email = user.Attributes?.find(attr => attr.Name === 'email')?.Value;
      const name = user.Attributes?.find(attr => attr.Name === 'name')?.Value;
      const sub = user.Attributes?.find(attr => attr.Name === 'sub')?.Value;
      
      return {
        userId: sub || user.Username, // Use sub (UUID) for video queries, fallback to Username
        username: user.Username, // Keep the original username for reference
        email: email,
        name: name,
        status: user.UserStatus,
        enabled: user.Enabled,
        created: user.UserCreateDate,
        lastModified: user.UserLastModifiedDate
      };
    });
    
    return createResponse(200, {
      success: true,
      users: transformedUsers,
      count: transformedUsers.length
    });
  } catch (error) {
    console.error('Error listing users:', error);
    throw error;
  }
}

async function handleListAllVideos() {
  try {
    const scanCommand = new ScanCommand({
      TableName: tableName
    });
    
    const result = await docClient.send(scanCommand);
    const videos = result.Items || [];
    
    // Sort by upload date (newest first)
    videos.sort((a, b) => new Date(b.upload_date) - new Date(a.upload_date));
    
    return createResponse(200, {
      success: true,
      videos: videos,
      count: videos.length
    });
  } catch (error) {
    console.error('Error listing all videos:', error);
    throw error;
  }
}

async function handleListUserVideos(targetUserId) {
  try {
    const queryCommand = new QueryCommand({
      TableName: tableName,
      IndexName: "user_id-upload_date-index",
      KeyConditionExpression: "user_id = :userId",
      ExpressionAttributeValues: {
        ":userId": targetUserId
      },
      ScanIndexForward: false // Sort by upload_date descending
    });
    
    const result = await docClient.send(queryCommand);
    const videos = result.Items || [];
    
    return createResponse(200, {
      success: true,
      videos: videos,
      count: videos.length,
      userId: targetUserId
    });
  } catch (error) {
    console.error('Error listing user videos:', error);
    throw error;
  }
}

async function handleDeleteVideo(event) {
  try {
    const body = JSON.parse(event.body || "{}");
    const { videoId, bucketLocation } = body;
    
    if (!videoId) {
      return createResponse(400, {
        error: "Missing required field: videoId"
      });
    }
    
    // Delete from DynamoDB
    const deleteCommand = new DeleteCommand({
      TableName: tableName,
      Key: {
        video_id: videoId
      }
    });
    
    await docClient.send(deleteCommand);
    
    // Delete from S3 if bucket location provided
    if (bucketLocation) {
      try {
        // Extract bucket name and key from the bucket location
        // Assuming bucketLocation is in format: s3://bucket-name/path/to/file
        const s3Url = new URL(bucketLocation.replace('s3://', 'https://'));
        const bucketName = s3Url.hostname.split('.')[0];
        const objectKey = s3Url.pathname.substring(1); // Remove leading slash
        
        const s3DeleteCommand = new DeleteObjectCommand({
          Bucket: bucketName,
          Key: objectKey
        });
        
        await s3Client.send(s3DeleteCommand);
        console.log('Successfully deleted video file from S3:', objectKey);
      } catch (s3Error) {
        console.error('Error deleting from S3:', s3Error);
        // Continue - we still deleted from DynamoDB
      }
    }
    
    return createResponse(200, {
      success: true,
      message: "Video deleted successfully",
      videoId: videoId
    });
  } catch (error) {
    console.error('Error deleting video:', error);
    throw error;
  }
} 