const { SESClient, SendEmailCommand } = require("@aws-sdk/client-ses");

const sesClient = new SESClient({ region: process.env.AWS_REGION });

exports.handler = async (event) => {
  console.log('Create Auth Challenge Event:', JSON.stringify(event, null, 2));

  const { request, response } = event;

  if (request.challengeName === 'CUSTOM_CHALLENGE') {
    // Generate a 6-digit OTP
    const otp = Math.floor(100000 + Math.random() * 900000).toString();
    
    // Store the OTP in the challenge metadata (Cognito will handle this securely)
    response.publicChallengeParameters = {
      email: request.userAttributes.email,
      trigger: 'passwordless-auth'
    };
    
    response.privateChallengeParameters = {
      answer: otp
    };
    
    response.challengeMetadata = 'PASSWORDLESS_AUTH';

    // Send OTP via email
    try {
      const emailParams = {
        Source: process.env.FROM_EMAIL || 'noreply@easyvideoshare.com',
        Destination: {
          ToAddresses: [request.userAttributes.email]
        },
        Message: {
          Subject: {
            Data: 'Easy Video Share - Your Login Code',
            Charset: 'UTF-8'
          },
          Body: {
            Html: {
              Data: `
                <html>
                  <body style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
                    <div style="text-align: center; margin-bottom: 30px;">
                      <h1 style="color: #667eea;">🎥 Easy Video Share</h1>
                    </div>
                    
                    <div style="background: #f8f9fa; padding: 20px; border-radius: 8px; margin-bottom: 20px;">
                      <h2 style="color: #2d3748; margin-top: 0;">Your Login Code</h2>
                      <p style="color: #4a5568; font-size: 16px; line-height: 1.5;">
                        Use this code to complete your passwordless login:
                      </p>
                      
                      <div style="text-align: center; margin: 20px 0;">
                        <div style="background: white; border: 2px solid #667eea; border-radius: 8px; 
                                    display: inline-block; padding: 15px 25px; font-size: 32px; 
                                    font-weight: bold; color: #667eea; letter-spacing: 8px;">
                          ${otp}
                        </div>
                      </div>
                      
                      <p style="color: #718096; font-size: 14px; text-align: center;">
                        This code will expire in 5 minutes.
                      </p>
                    </div>
                    
                    <div style="border-top: 1px solid #e2e8f0; padding-top: 20px; color: #718096; font-size: 12px;">
                      <p>If you didn't request this login code, please ignore this email.</p>
                      <p>For security, never share this code with anyone.</p>
                    </div>
                  </body>
                </html>
              `,
              Charset: 'UTF-8'
            },
            Text: {
              Data: `
Easy Video Share - Your Login Code

Your login code is: ${otp}

This code will expire in 5 minutes.

If you didn't request this login code, please ignore this email.
For security, never share this code with anyone.
              `,
              Charset: 'UTF-8'
            }
          }
        }
      };

      await sesClient.send(new SendEmailCommand(emailParams));
      console.log('OTP email sent successfully to:', request.userAttributes.email);
      
    } catch (error) {
      console.error('Failed to send OTP email:', error);
      // Don't fail the challenge if email sending fails
      // The OTP is still valid, user might have received it
    }
  }

  console.log('Create Auth Challenge Response:', JSON.stringify(response, null, 2));
  return event;
}; 