'use strict';

module.exports = (srcPath, bundlePath) => {
  const Broadcast = require(srcPath + 'Broadcast');
  const Parser = require('bundles/bundle-example-lib/lib/CommandParser').CommandParser;
  const ItemUtil = require('bundles/myelin-lib/lib/ItemUtil');
  const { InventoryFullError } = require(srcPath + '/Inventory');

  return {
    aliases: [ 'unwield', 'unequip' ],
    usage: 'remove <item>',
    command: state => (arg, player) => {
      if (!arg.length) {
        return Broadcast.sayAt(player, 'Remove what?');
      }

      if (arg === 'all') {
        for (const [slot, item] of player.equipment) {
          remove(player, slot, item);
        }
        return;
      }

      const result = Parser.parseDot(arg, player.equipment, true);
      if (!result) {
        return Broadcast.sayAt(player, "You aren't wearing anything like that.");
      }

      const [slot, item] = result;
      remove(player, slot, item);
    }
  };

  function remove(player, slot, item) {
    try {
      player.unequip(slot);
    } catch(e) {
      Broadcast.sayAt(player, `<yellow>You cannot un-equip: </yellow>${ItemUtil.display(item)}<yellow>.</yellow>`);
      if (e instanceof InventoryFullError) {
        return Broadcast.sayAt(player, '<yellow><b>Your inventory is full.</b></yellow>');
      }
    }
    Broadcast.sayAt(player, `<green>You un-equip: </green>${ItemUtil.display(item)}<green>.</green>`);
  }
};
