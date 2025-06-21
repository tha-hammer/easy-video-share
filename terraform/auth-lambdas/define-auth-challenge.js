exports.handler = async (event) => {
  console.log('Define Auth Challenge Event:', JSON.stringify(event, null, 2));

  const { request, response } = event;
  
  // If user doesn't exist, fail the auth
  if (request.userNotFound) {
    response.issueTokens = false;
    response.failAuthentication = true;
    response.challengeName = 'CUSTOM_CHALLENGE';
    return event;
  }

  // First attempt - start with custom challenge (OTP)
  if (request.session.length === 0) {
    response.challengeName = 'CUSTOM_CHALLENGE';
    response.issueTokens = false;
    response.failAuthentication = false;
  }
  // Second attempt - check if the challenge was answered correctly
  else if (request.session.length === 1 && request.session[0].challengeResult === true) {
    response.issueTokens = true;
    response.failAuthentication = false;
  }
  // Challenge failed
  else {
    response.issueTokens = false;
    response.failAuthentication = true;
  }

  console.log('Define Auth Challenge Response:', JSON.stringify(response, null, 2));
  return event;
}; 