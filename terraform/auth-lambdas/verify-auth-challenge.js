exports.handler = async (event) => {
  console.log('Verify Auth Challenge Event:', JSON.stringify(event, null, 2));

  const { request, response } = event;

  if (request.challengeName === 'CUSTOM_CHALLENGE') {
    // Get the expected answer from the private challenge parameters
    const expectedAnswer = request.privateChallengeParameters.answer;
    const providedAnswer = request.challengeAnswer;

    console.log('Expected OTP:', expectedAnswer);
    console.log('Provided OTP:', providedAnswer);

    // Verify the OTP (simple string comparison)
    if (expectedAnswer === providedAnswer) {
      response.answerCorrect = true;
      console.log('OTP verification successful');
    } else {
      response.answerCorrect = false;
      console.log('OTP verification failed');
    }
  }

  console.log('Verify Auth Challenge Response:', JSON.stringify(response, null, 2));
  return event;
}; 