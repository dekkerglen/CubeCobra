const follow = async (cubeID) => {
  await fetch(`/cube/api/follow/${cubeID}`);
  location.reload();
}

const unfollow = async (cubeID) => {
  await fetch(`/cube/api/unfollow/${cubeID}`);
  location.reload();
}
