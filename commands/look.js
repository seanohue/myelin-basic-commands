'use strict';

const humanize = (sec) => { return require('humanize-duration')(sec, { round: true }); };
const {sprintf} = require('sprintf-js');

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
    B.sayAt(player, '<yellow><b>' + sprintf('%-65s', room.title) + '</b></yellow>');
    B.sayAt(player, B.line(60));

    if (!player.getMeta('config.brief')) {
      B.sayAt(player, room.description, 80);
    }

    if (player.getMeta('config.minimap')) {
      B.sayAt(player, '');
      state.CommandManager.get('map').execute(4, player);
    }

    B.sayAt(player, '');

    // show all players
    room.players.forEach(otherPlayer => {
      if (otherPlayer === player) {
        return;
      }
      let combatantsDisplay = '';
      if (otherPlayer.isInCombat()) {
        combatantsDisplay = getCombatantsDisplay(otherPlayer);
      }
      B.sayAt(player, '[Player] ' + otherPlayer.name + combatantsDisplay);
    });

    // show all the items in the rom
    room.items.forEach(item => {
      if (item.metadata.detail) return;
      ItemUtil.renderItemRoomDesc(item, player);
    });

    // show all npcs
    room.npcs.forEach(npc => {
      // show quest state as [!], [%], [?] for available, in progress, ready to complete respectively
      let hasNewQuest, hasActiveQuest, hasReadyQuest;
      if (npc.quests) {
        const quests = npc.quests.map(qid => state.QuestFactory.create(state, qid, player));
        hasNewQuest = quests.find(quest => player.questTracker.canStart(quest));
        hasReadyQuest = quests.find(quest => {
          return player.questTracker.isActive(quest.id) && player.questTracker.get(quest.id).getProgress().percent >= 100;
        });
        hasActiveQuest = quests.find(quest => {
          return player.questTracker.isActive(quest.id) && player.questTracker.get(quest.id).getProgress().percent < 100;
        });

        let questString = '';
        if (hasNewQuest || hasActiveQuest || hasReadyQuest) {
          questString += hasNewQuest ? '[<b><yellow>!</yellow></b>]' : '';
          questString += hasActiveQuest ? '[<b><yellow>%</yellow></b>]' : '';
          questString += hasReadyQuest ? '[<b><yellow>?</yellow></b>]' : '';
          B.at(player, questString + ' ');
        }
      } // could also represent in websocket GUI

      let combatantsDisplay = '';
      if (npc.isInCombat()) {
        combatantsDisplay = getCombatantsDisplay(npc);
      }

      // color NPC label by difficulty
      let npcLabel = getNpcLevel(player, npc);

      function getNpcLevel(player, npc) {
        switch (true) {
          case (player.level - npc.level > 4): return '<cyan>NPC</cyan>';
          case (npc.level - player.level > 9): return '<b><black>NPC</black></b>';
          case (npc.level - player.level > 5): return '<red>NPC</red>';
          case (npc.level - player.level > 3): return '<yellow>NPC</red>';
          default: return '<green>NPC</green>';
        }
      }

      B.sayAt(player, `[${npcLabel}] ` + npc.name + combatantsDisplay);
    });

    B.at(player, '[<yellow><b>Exits</yellow></b>: ');
      // find explicitly defined exits
      let foundExits = Array.from(room.exits).map(ex => {
        return [ex.direction, state.RoomManager.getRoom(ex.roomId)];
      });

      // infer from coordinates
      if (room.coordinates) {
        const coords = room.coordinates;
        const area = room.area;
        const directions = {
          north: [0, 1, 0],
          south: [0, -1, 0],
          east: [1, 0, 0],
          west: [-1, 0, 0],
          up: [0, 0, 1],
          down: [0, 0, -1],
        };

        foundExits = [...foundExits, ...(Object.entries(directions)
          .map(([dir, diff]) => {
            const [x, y, z] = diff;
            return [dir, area.getRoomAtCoordinates(
              coords.x + x, 
              coords.y + y, 
              coords.z + z
            )];
          })
          .filter(([dir, exitRoom]) => {
            return !!exitRoom;
          })
        )];
      }

      B.at(player, foundExits.map(([dir, exitRoom]) => {
        const door = room.getDoor(exitRoom) || exitRoom.getDoor(room);
        if (door && (door.locked || door.closed)) {
          return '(' + dir + ')';
        }

        return dir;
      }).join(' '));

      if (!foundExits.length) {
        B.at(player, 'none');
      }
      B.sayAt(player, ']');

      if (player.getMeta('config.autoscan')) {
        state.CommandManager.get('scan').execute('', player);
      }
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

function getCombatantsDisplay(entity) {
  const combatantsList = [...entity.combatants.values()].map(combatant => combatant.name);
  return `, <red>fighting </red>${combatantsList.join("<red>,</red> ")}`;
}
