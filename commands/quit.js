'use strict';

module.exports = (srcPath) => {
  const Broadcast = require(srcPath + 'Broadcast');

  return {
    usage: 'quit',
    aliases: ['signoff', 'logout', 'signout', 'logoff'],
    command: (state) => (args, player) => {
      if (player.isInCombat()) {
        return Broadcast.sayAt(player, "You're too busy fighting for your life!");
      }

      player.emit('quit');
      player.save(() => {
        Broadcast.sayAt(player, "Goodbye!");
        player.socket.emit('close');
      });
    }
  };
};
