'use strict';

const ItemUtil = require('bundles/myelin-lib/lib/ItemUtil');

module.exports = (srcPath) => {
  return  {
    listeners: {

      /**
       * Emitted when someone looks at the player.
       *
       * @param {Character} observer
       * @returns
       */
      look: state => function(observer) {
        ItemUtil.renderEquipment(observer, this);
      },
    }
  };
}