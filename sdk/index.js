module.exports = function createUser(user) {
    return new Promise(resolve => {
      setTimeout(function() {
        resolve({ user, token: "test.token" });
      }, 1000);
    });
  }