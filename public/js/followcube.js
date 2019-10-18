const follow = async (cubeID) => {
  await fetch(`/cube/api/follow/${cubeID}`);
  await console.log(`followed ${cubeID}`);
  await location.reload();
}

const unfollow = async (cubeID) => {
  await fetch(`/cube/api/unfollow/${cubeID}`);
  await console.log(`unfollowed ${cubeID}`);
  await location.reload();
}