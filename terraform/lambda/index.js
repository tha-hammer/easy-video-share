const { DynamoDBClient } = require("@aws-sdk/client-dynamodb");
const { DynamoDBDocumentClient, PutCommand, QueryCommand, ScanCommand } = require("@aws-sdk/lib-dynamodb");

const dynamoClient = new DynamoDBClient({ region: process.env.AWS_REGION });
const docClient = DynamoDBDocumentClient.from(dynamoClient);

const tableName = process.env.DYNAMODB_TABLE;
const corsOrigin = process.env.CORS_ORIGIN || "*";

// CORS headers
const corsHeaders = {
  "Access-Control-Allow-Origin": corsOrigin,
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, X-Amz-Date, Authorization, X-Api-Key, X-Amz-Security-Token"
};

// Response helper
const createResponse = (statusCode, body) => ({
  statusCode,
  headers: corsHeaders,
  body: JSON.stringify(body)
});

exports.handler = async (event) => {
  console.log("Event:", JSON.stringify(event, null, 2));

  try {
    const httpMethod = event.httpMethod;
    
    // Handle CORS preflight
    if (httpMethod === "OPTIONS") {
      return createResponse(200, { message: "CORS preflight" });
    }

    // Extract user ID from Cognito JWT token
    let userId = null;
    console.log("Request context:", JSON.stringify(event.requestContext, null, 2));
    
    if (event.requestContext && event.requestContext.authorizer) {
      console.log("Authorizer context:", JSON.stringify(event.requestContext.authorizer, null, 2));
      // Cognito puts user info in the authorizer context
      const claims = event.requestContext.authorizer.claims;
      if (claims) {
        userId = claims.sub; // 'sub' is the unique user ID in Cognito
        console.log("Authenticated user:", userId);
        console.log("User email:", claims.email);
      } else {
        console.log("No claims found in authorizer context");
      }
    } else {
      console.log("No authorizer context found");
    }

    // Handle POST - Create video metadata
    if (httpMethod === "POST") {
      // Check if user is authenticated
      if (!userId) {
        return createResponse(401, {
          error: "Authentication required"
        });
      }

      const body = JSON.parse(event.body || "{}");
      
      // Validate required fields (username no longer required - comes from JWT)
      if (!body.title || !body.filename || !body.bucketLocation) {
        return createResponse(400, {
          error: "Missing required fields: title, filename, bucketLocation"
        });
      }

      // Generate unique video ID using user ID
      const videoId = `${userId}_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
      
      // Get user email from JWT claims for display purposes
      const userEmail = event.requestContext.authorizer.claims.email;
      
      // Create metadata record
      const videoMetadata = {
        video_id: videoId,
        user_id: userId,
        user_email: userEmail, // For display purposes
        title: body.title.trim(),
        filename: body.filename,
        bucket_location: body.bucketLocation,
        upload_date: new Date().toISOString(),
        file_size: body.fileSize || null,
        content_type: body.contentType || null,
        duration: body.duration || null,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      };

      // Save to DynamoDB
      const putCommand = new PutCommand({
        TableName: tableName,
        Item: videoMetadata
      });

      await docClient.send(putCommand);

      return createResponse(201, {
        success: true,
        videoId: videoId,
        message: "Video metadata saved successfully",
        data: videoMetadata
      });
    }

    // Handle GET - List videos (for authenticated user only)
    if (httpMethod === "GET") {
      // Check if user is authenticated
      if (!userId) {
        return createResponse(401, {
          error: "Authentication required"
        });
      }

      // Query videos by user_id using GSI (we'll need to update the GSI)
      const queryCommand = new QueryCommand({
        TableName: tableName,
        IndexName: "user_id-upload_date-index",
        KeyConditionExpression: "user_id = :userId",
        ExpressionAttributeValues: {
          ":userId": userId
        },
        ScanIndexForward: false // Sort by upload_date descending (newest first)
      });
      
      const result = await docClient.send(queryCommand);
      const videos = result.Items || [];

      return createResponse(200, {
        success: true,
        count: videos.length,
        videos: videos
      });
    }

    // Method not allowed
    return createResponse(405, {
      error: `Method ${httpMethod} not allowed`
    });

  } catch (error) {
    console.error("Error:", error);
    
    return createResponse(500, {
      error: "Internal server error",
      message: error.message,
      ...(process.env.NODE_ENV === "development" && { stack: error.stack })
    });
  }
}; 