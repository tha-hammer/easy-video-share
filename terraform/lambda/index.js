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

    // Handle POST - Create video metadata
    if (httpMethod === "POST") {
      const body = JSON.parse(event.body || "{}");
      
      // Validate required fields
      if (!body.username || !body.title || !body.filename || !body.bucketLocation) {
        return createResponse(400, {
          error: "Missing required fields: username, title, filename, bucketLocation"
        });
      }

      // Generate unique video ID
      const videoId = `${body.username}_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
      
      // Create metadata record
      const videoMetadata = {
        video_id: videoId,
        username: body.username.toLowerCase().trim(),
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

    // Handle GET - List videos (with optional username filter)
    if (httpMethod === "GET") {
      const queryParams = event.queryStringParameters || {};
      const username = queryParams.username;

      let videos = [];

      if (username) {
        // Query videos by username using GSI
        const queryCommand = new QueryCommand({
          TableName: tableName,
          IndexName: "username-upload_date-index",
          KeyConditionExpression: "username = :username",
          ExpressionAttributeValues: {
            ":username": username.toLowerCase().trim()
          },
          ScanIndexForward: false // Sort by upload_date descending (newest first)
        });
        
        const result = await docClient.send(queryCommand);
        videos = result.Items || [];
      } else {
        // Scan all videos (for development - consider pagination for production)
        const scanCommand = new ScanCommand({
          TableName: tableName
        });
        
        const result = await docClient.send(scanCommand);
        videos = result.Items || [];
        
        // Sort by upload_date descending
        videos.sort((a, b) => new Date(b.upload_date) - new Date(a.upload_date));
      }

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