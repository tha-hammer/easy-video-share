exports.handler = async (event) => {
  console.log('Pre Authentication Event:', JSON.stringify(event, null, 2));

  const { request, response } = event;

  // Allow all pre-authentication requests to proceed
  // This lambda is mainly used for logging and any pre-auth checks
  
  console.log('Pre-auth check for user:', request.userAttributes?.email);
  
  // You can add additional pre-authentication logic here, such as:
  // - Rate limiting
  // - Geo-blocking
  // - Account status checks
  // - etc.

  // For now, we'll allow all authentication attempts to proceed
  console.log('Pre-authentication successful for user:', request.userAttributes?.email);

  return event;
}; 