'use strict';

const humanize = (sec) => { return require('humanize-duration')(sec, { round: true }); };

module.exports = (srcPath, bundlePath) => {
  const B = require(srcPath + 'Broadcast');
  const CommandParser = require('bundles/bundle-example-lib/lib/CommandParser').CommandParser;
  const Item          = require(srcPath + 'Item');
  const ItemType      = require(srcPath + 'ItemType');
  const Logger        = require(srcPath + 'Logger');
  const Player        = require(srcPath + 'Player');
  const ItemUtil      = require('bundles/myelin-lib/lib/ItemUtil');

  return {
    usage: "look [thing]",
    aliases: ['inspect', 'examine', 'ls', 'search', 'x'],
    command: state => (args, player) => {
      if (args) {
        return lookEntity(state, player, args);
      }

      if (!player.room) {
        Logger.error(player.getName() + ' is in limbo.');
        return B.sayAt(player, 'You are in a deep, dark void.');
      }

      lookRoom(player);
    }
  };

  function lookRoom(player) {
    const room = player.room;
    room.emit('look', player);
  }

  function lookEntity(state, player, args) {
    const room = player.room;

    args = args.split(' ');
    let search = null;

    if (args.length > 1) {
      search = args[0] === 'in' || args[0] === 'at' ? args[1] : args[0];
    } else {
      search = args[0];
    }

    let entity = CommandParser.parseDot(search, room.items)
      || CommandParser.parseDot(search, room.players)
      || CommandParser.parseDot(search, room.npcs)
      || CommandParser.parseDot(search, player.inventory);

    if (!entity) {
      Logger.warn('Player tried looking for ' + args);
      return B.sayAt(player, "You don't see anything like that here.");
    }

    if (entity instanceof Player) {
      // TODO: Show player equipment?
      B.sayAt(player, `You see ${entity.name}.`);
      entity.emit('look', player); // yay
      return;
    }

    B.sayAt(player, entity.description, 80);

    if (entity.timeUntilDecay) {
      B.sayAt(player, `You estimate that ${entity.name} will rot away in ${humanize(entity.timeUntilDecay)}.`);
    }

    const usable = entity.getBehavior('usable');
    if (usable) {
      if (usable.spell) {
        const useSpell = state.SpellManager.get(usable.spell);
        if (useSpell) {
          useSpell.options = usable.options;
          B.sayAt(player, useSpell.info(player));
        }
      }

      if (usable.effect && usable.config.description) {
        B.sayAt(player, usable.config.description);
      }

      if (usable.charges) {
        B.sayAt(player, `There are ${usable.charges} charges remaining.`);
      }
    }
    if (entity instanceof Item) {
      switch (entity.type) {
        case ItemType.WEAPON:
        case ItemType.ARMOR:
          B.sayAt(player, ItemUtil.renderItem(state, entity, player));
          break
        case ItemType.CONTAINER: {
          if (!entity.inventory || !entity.inventory.size) {
            B.sayAt(player, `${entity.name} is empty.`);
            break;
          }

          if (entity.closed) {
            B.sayAt(player, `It is closed.`);
            break;
          }

          B.at(player, 'Contents');
          if (isFinite(entity.inventory.getMax())) {
            B.at(player, ` (${entity.inventory.size}/${entity.inventory.getMax()})`);
          }
          B.sayAt(player, ':');

          for (const [, item ] of entity.inventory) {
            B.sayAt(player, '  ' + ItemUtil.display(item));
          }
          break;
        }
      }

      if (entity.hasBehavior('resource') && player.level < 10) {
        B.sayAt(player, `<b><cyan>HINT:</b> You may <b>gather</b> resources from ${entity.name}, destroying it in the process.</cyan>`);
      }
      room.emit('itemLook', player, entity.entityReference);
    }

    // For room-specific descriptiony things.
    entity.emit('look', player);
  }
};
