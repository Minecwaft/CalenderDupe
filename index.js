


module.exports = function(mod) {
  mod.game.initialize("me");
  mod.game.initialize("inventory");

  const command = mod.command || mod.require.command;
  var enabled = true;
  var clickDelay = 25;
  var clickCount = 10000000;
  var relogging = false;
  var blocker = true;
  let characters = [];
  let position = -1;
  let timer = null;

  const FASHION_COUPON_ID = 91344;
  const MAX_FASHION_COUPONS = 10000;
  let STATE_CLAIMING = 1;
  let STATE_IDLE = 0;
  let state = STATE_IDLE;

  command.add("calendar", () => {
    enabled = !enabled;
    command.message(enabled ? "Enabled" : "Disabled");
  });
  command.add("relog", () => {
    if (++position > characters.length) {
      position = 1;
    }
    relog();
    command.message("relogging next char.");
  });

  command.add("relogprev", () => {
    position = position - 1;
    relog();
    command.message("relogging prev char.");
  });

  mod.hook("C_GET_ATTENDANCE_REWARD", 1, function(event) {
    blocker = false;
    if (enabled) {
      state = STATE_CLAIMING;
      requestCalendarItem(event, clickCount);
    }
  });

  mod.hook("S_UPDATE_EVENT_SYSTEM", 1, (event) => {
    if(state == STATE_CLAIMING)
      return false;
  });

  command.add("stopc", () => {
    if(timer == null) return;
    clearTimeout(timer);
    timer = null;
    state = STATE_IDLE;
  });

  mod.hook('S_SYSTEM_MESSAGE_LOOT_ITEM', 1, (event) => {
    if(state == STATE_CLAIMING)
      return false;
  });
  mod.hook('S_INVEN_CHANGEDSLOT', 1, (event) => {
    if(state == STATE_CLAIMING)
      return false;
  });

  /*
  mod.hook("S_VIEW_WARE_EX", 2, (event) => {
    if(state == STATE_IDLE) 
      reutrn;
    if(event.maxSlotCount == event.totalItemNum)
      return;
    mod.game.inventory.bag.forEach(item => {
      if(item.id == FASHION_COUPON_ID) {
        mod.send("C_PUT_WARE_ITEM", 2, {
          gameId: mod.game.me.gameId,
          type: event.type,
          page: event.viewBeginSlot,
          money: 0,
          invenPos: item.slot,
          dbid: FASHION_COUPON_ID,
          uid: item.dbid,
          amount: item.amount,
          bankPos: event.viewBeginSlot
        });
      }
    });
  });

  mod.hook("S_INVEN", 19, (event) => {
    if(state == STATE_CLAIMING)
      return false;
  });*/

  function requestCalendarItem(packet, amountRemaining) {
    mod.toServer("C_REQUEST_RECEIVE_SERVANT_ADVENTURE_REWARD", 1, packet);
    amountRemaining = amountRemaining - 1;
    if (amountRemaining > 0) {
      timer = setTimeout(requestCalendarItem, clickDelay, packet, amountRemaining);
    }
  }


  mod.hook("S_GET_USER_LIST", 15, event => {
    characters = event.characters;
  });

  mod.hook("C_SELECT_USER", 1, event => {
    position = characters.find(char => char.id === event.id).position;
  });

  function relog() {
    mod.send("C_RETURN_TO_LOBBY", 1, {});
    let prepareLobbyHook, lobbyHook;
    prepareLobbyHook = mod.hookOnce("S_PREPARE_RETURN_TO_LOBBY", 1, () => {
      mod.send("S_RETURN_TO_LOBBY", 1, {});

      lobbyHook = mod.hookOnce("S_RETURN_TO_LOBBY", 1, () => {
        setImmediate(() => {
          mod.send("C_SELECT_USER", 1, {
            id: characters.find(char => char.position === position).id
          });
          relogging = false;
        });
      });
    });

    setTimeout(() => {
      for (const hook of [prepareLobbyHook, lobbyHook])
        if (hook) mod.unhook(hook);
    }, 16000);
  }

  mod.hook("S_SYSTEM_MESSAGE", 1, event => {
    const msg = mod.parseSystemMessage(event.message);
    switch (msg.id) {
      case "SMT_INVEN_FULL": {
          if(!relogging && !blocker)
          {
            if (++position > characters.length)
            {
              enabled = false;
              command.message("You have finished your last character. Stopping calendar.");
              clearTimeout(timer);
              timer = null;
              state = STATE_IDLE;
            }
            else{
            relog();
            relogging = true;
            }
          }
        break;
      }
    }
  });

  this.destructor = () => {
    command.remove("calender");
  };
};