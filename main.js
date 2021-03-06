   var 
        gameport        = process.env.PORT || 4004,
        http            = require('http'),

        express         = require('express'),
        UUID            = require('node-uuid'),

        verbose         = false,
        app             = module.exports.app = express(),
        server          = http.createServer(app);

    //Tell the server to listen for incoming connections
    server.listen( gameport, "128.205.27.232" );
    var io              = require('socket.io').listen(server);

    //Log something so we know that it succeeded.
    console.log('\t :: Express :: Listening on port ' + gameport );

    //By default, we forward the / path to index.html automatically.
    app.get( '/', function( req, res ){ 
        res.sendfile( __dirname + '/index.html' );
    });


    //This handler will listen for requests on /*, any file from the root of our server.
    //See expressjs documentation for more info on routing.
    app.get( '/*' , function( req, res, next ) {
        var file = req.params[0];
        if(verbose) console.log('\t :: Express :: file requested : ' + file);
        if(verbose) console.log('\t' + __dirname + '/index.html' );
        res.sendfile( __dirname + '/index.html' );

    }); //app.get *

    var sio = io;
    var STATE_IN_LOBBY  = "inLobby",
        STATE_IN_GAME   = "inGame",

        ROLE_CHASER     = "chaser",
        ROLE_RUNNER     = "runner"

        PLAYER_INFO     = "playerInfo";

    /*
     * Sets up initial player object 
     */
    var Player = function Player(client, name){//, xPos, yPos, xVel, yVel, color, state, role, score) {
      this.client = client;
      this.name = name;
      this.xPos = 0;
      this.yPos = 0;
      this.xVel = 0;
      this.yVel = 0;
      this.color = "#ff0000";
      this.state = STATE_IN_LOBBY;
      this.speed = 0
      this.role = "";
      this.score = 0;
      this.friction = .8;
      this.game = null;
      // this.up_press = false;
      // this.down_press = false;
      // this.left_press = false;
      // this.right_press = false;
      this.level = 0;
    }

    Player.prototype.update = function(left_press,up_press,down_press,right_press) {
        if (left_press) { //left
          if (this.xVel > -this.speed) {
            this.xVel--;
          }
        }
        if (right_press) { //right
          if (this.xVel < this.speed) {
            this.xVel++;
          }
        }
        if (up_press) { //up
          if (this.yVel > -this.speed) {
            this.yVel--;
          }
        }
        if (down_press) { //down
          if (this.yVel < this.speed) {
            this.yVel++;
          }
        }
    }

    Player.prototype.evaluate = function(game) {
      this.yVel *= this.friction;
      this.yPos += this.yVel;
      this.xVel *= this.friction;
      this.xPos += this.xVel;

      if (this.xPos >= game.viewportWidth - this.size) {
          this.xPos = game.viewportWidth - this.size;
      } else if (this.xPos <= this.size) {
          this.xPos = this.size;
      }

      if (this.yPos > game.viewportHeight - this.size) {
          this.yPos = game.viewportHeight - this.size;
      } else if (this.yPos <= this.size) {
          this.yPos = this.size;
      }
    }

    /*
     * Returns whether is chaser.
     */
    Player.prototype.isChaser = function() {
      return (role == ROLE_CHASER);
    }

    /*
     * Function called for when player disconnects.
     * Not fully functional with games yet
     */
    Player.prototype.disconnected = function() {
      //TODO: SEND THIS TWO GAMES THAT HAVE THIS USER
      JSON.stringify( {
          "action" : "disconnected",
          "uuid" : this.client.uuid
        });
    }
    /*
     * Returns whether the player is in lobby.
     */
    Player.prototype.inLobby = function() {
      return (this.state == STATE_IN_LOBBY);
    }

    /*
     * Object containing information about the player.
     */
    var Link = function Link(xPos, yPos, width, height, url) {
      this.xPos = xPos;
      this.yPos = yPos;
      this.width = width;
      this.height = height;
      this.url = url;
    }

    /*
     * Object containing information about the Links.
     */
    var LinkLevel = function LinkLevel(arr) {
      this.links = arr;
      this.chosen = null;
    }

    /*
     * Object containing information about the player.
     */
    var Game = function Game(fromPlayer, fromUuid, toPlayer, toUuid, viewportHeight, viewportWidth) {
      this.uuid = UUID(); //specific id of game
      this.fromUuid = fromUuid; //original game sender
      this.fromPlayer = fromPlayer;

      this.toUuid = toUuid; //original game recipient
      this.toPlayer = toPlayer;
      this.linkLevels = [];
      this.interval = null;

      this.viewportHeight = viewportHeight;
      this.viewportWidth = viewportWidth;
      
      console.log(this.uuid);
      //send out requests to initial players
      toPlayer.client.emit(PLAYER_INFO, JSON.stringify({
        "action" : "request_to_play_player",
        "from_uuid" : this.fromUuid,
        "game_uuid" : this.uuid
      }));
    }

    /*
     * Gets all player data for a given Game and returns it
     * as a JSON array of player data.
     */
    function getPlayerDataAsJSON(game) {
      var pData = []
      pdata.push();
      pdata.push();
      console.log("data [" + JSON.stringify(pData) + "]");
      return pData;
    }

    /*
     * Sends player data for a given game to all players
     */
    Game.prototype.sendPlayerData = function() {
      var jsonPlayers = {
        "action" : "game_player_data",
        [toUuid] : {
              "xPos" : game.fromPlayer.player.xPos,
              "yPos" : game.fromPlayer.player.yPos,
              "color" : game.fromPlayer.player.color,
              "score" : game.fromPlayer.color.score,
            },
        [fromUuid] : {
            "xPos" : game.toPlayer.player.xPos,
            "yPos" : game.toPlayer.player.yPos,
            "color" : game.toPlayer.player.color,
            "score" : game.toPlayer.color.score,
          }
      }
      this.fromPlayer.client.emit("playerInfo", jsonPlayers);
      this.toPlayer.client.emit("playerInfo", jsonPlayers);
    }

    function runGame(g){
      g.fromPlayer.evaluate();
      g.toPlayer.evaluate();
      g.sendPlayerData();
      setTimeout(runGame(g), 10);
    }

    Game.prototype.startGame = function() {
      var g = this;
      this.interval = setInterval(function(){runGame(g)},1);
    }

    /*
     * Updates what the player is pressing
     */
    Game.prototype.updatePlayer = function(msgJson, uuid){
      if(fromUuid == uuid) {
        fromPlayer.up_press = msgJson.up_press;
        fromPlayer.down_press = msgJson.down_press;
        fromPlayer.left_press = msgJson.left_press;
        fromPlayer.right_press = msgJson.right_press;
      } else if(toUuid == uuid) {
        toPlayer.up_press = msgJson.up_press;
        toPlayer.down_press = msgJson.down_press;
        toPlayer.left_press = msgJson.left_press;
        toPlayer.right_press = msgJson.right_press;
      }
    }

    /*
     * Spacebar was hit check if in bounds.
     */
    Game.prototype.spaceBar = function(uuid){
      if(fromUuid == uuid) {
        if(fromPlayer.isChaser()) {
          if(fromPlayer.linkLevel < toPlayer.linkLevel) {
            var link = this.linkLevels[fromPlayer.linkLevel].chosen
            //TODO FROM PLAYER CHECK IF OVER
          }
        } else {
          //TODO FIND CHOSEN LINK AND SET IT
        }
      } else if(toUuid == uuid) {
        if(toPlayer.isChaser()) {
          if(toPlayer.linkLevel < fromPlayer.linkLevel) {
            var link = this.linkLevels[toPlayer.linkLevel].chosen
            //TODO TO PLAYER CHECK IF OVER
          }
        } else {
          //TODO FIND CHOSEN LINK AND SET IT
        }
      }
    }

    /*
     * Adds a new LinkLevel an progresses player if correct.
     */
    Game.prototype.linkLevel = function(msgJson, uuid) {
      if(fromUuid == uuid) {
        if(!fromPlayer.isChaser()) {
          this.linkLevels.push(new LinkLevel(msgJson.links));
          this.fromPlayer.level = this.fromPlayer.level + 1;
        }
      } else if(toUuid == uuid) {
        if(!toPlayer.isChaser()) {
          this.linkLevels.push(new LinkLevel(msgJson.links));
          this.toPlayer.level = this.toPlayer.level + 1;
        }
      }
    }

    //List of overall players in the whole application
    var players = [];
    //List of all games
    var games = [];

    /*
     *  Returns a list of Users that are in a Lobby
     */
    function getPlayersInLobby(myUuid) {
      var uList = [];
      console.log("length [" + players.length + "] [" + myUuid + "]");
      players.forEach(function(item, index){
        console.log("item [" + item.name + "] [" + item.client.uuid + "]");
        if(item.inLobby() && item.client.uuid != myUuid) {
          uuID = item.client.uuid;
          uList.push( {[uuID] : item.name });
        }
      });
      return JSON.stringify({
        "action" : "in_lobby",
        "players" : JSON.stringify(uList)
      });
    }

    /*
     * Sets uuid for user up with a player name.
     * ONLY SHOULD BE USED ONCE!!! ON PLAYER SETUP
     */
    // function setPlayerName(uuid, playerName) {
    //   players.forEach(function(item, index){
    //     if(item.client.uuid == uuid) {
    //       item.name = playerName
    //     }
    //     // console.log("player [" + item.name + "]");
    //   });
    // }

    /*
     * Removes player from players
     */
    function playerDisconnect(userid){
      //removes specific player from players
      players = players.filter(function(item){
        if(item.client.uuid != userid) {
          // console.log("Saving [" + userid + "]");
          return true;
        } else {
          // console.log("Removing [" + userid + "]");
          item.disconnected();
          return false;
        }
      });
    }

    /*
     * Checks whether either player is in a game.
     */
    function eitherPlayerInGame(fromUuid, toUuid) {
      players.forEach(function(item,each){
        if(item.client.uuid == fromUuid || item.client.uuid == toUuid) {
          return true;
        }
      });
      return false;
    }

    /*
     * Checks whether either player is in a game.
     */
    function searchForRepeatRequest(fromUuid) {
      games.forEach(function(item,index) {
        if(item.fromUuid == fromUuid) {
          return true;
        }
      });
      return false;
    }

    /*
     * Returns the game related to the uuid
     */
    function getGameFromGameUuid(gameUuid) {
      console.log("games length [" + games.length + "]");
      var out = null;
      games.forEach(function(item,index) {
        if(item.uuid == gameUuid) {
          out = item;
        }
      });
      return out;
    }

    sio.sockets.on('connection', function (client) {

        client.uuid = UUID();

        var temp = JSON.stringify( {
            "action" : "create_player",
            "uuid" : client.uuid
        });
        client.emit(PLAYER_INFO, temp);

        client.on('chatMessage', function(msg){
          console.log('msg: ' + msg);
        });

        client.on(PLAYER_INFO, function(msg){
          var msgOb = JSON.parse(msg);
          console.log(msg + " action [" + msgOb.action + "]");
          switch(msgOb.action) {
              case "in_lobby":
                console.log("sending for lobby");
                client.emit(PLAYER_INFO, getPlayersInLobby(client.uuid));
                break;
              case "create_player":
                console.log("creating player finalization [" + msgOb.name + "]");
                // setPlayerName(msgOb.uuid, msgOb.name);
                if(players.filter(function(index){index.client.uuid == client.uuid}).length == 0) {
                  players.push(new Player(client, msgOb.name));
                  players.forEach(function(item,index){
                    item.client.emit(PLAYER_INFO, getPlayersInLobby(item.client.uuid));
                  });
                }
                break;
              case "game_player_data":
                console.log("request player data");
                var game = games.filter(function(e) {(e.fromUuid == client.uuid || e.toUuid == client.uuid)});
                if(game != null) {
                  game.sendPlayerData();
                }
                // client.emit(PLAYER_INFO, );
                break;
              case "request_to_play_player":
                console.log("req to play");
                // checks if either player is in a game
                if(!eitherPlayerInGame(client.uuid, msgOb.to_uuid)) {
                  // checks if same player already requested
                  if(!searchForRepeatRequest(client.uuid)) {
                    //add new game with player that is sent to
                    var fromP;
                    var toP;
                    players.forEach(function(item,index){
                      if(item.client.uuid == msgOb.to_uuid) {
                        toP = item;
                      } else if(item.client.uuid == client.uuid) {
                        fromP = item;
                      }
                    });
                    if(fromP != null && toP != null) {
                      console.log("Game created [" + fromP + "] [" + fromP.client.uuid + "] [" + toP + "] [" + toP.client.uuid + "]");
                      games.push(new Game(fromP, fromP.client.uuid, toP, toP.client.uuid, msgOb.viewportHeight, msgOb.viewportWidth));
                    }
                  }
                }
                break;
              case "response_to_play_player":
                console.log("response to play player [" + msgOb.status + "]");
                if(msgOb.status == "accept") {
                  var game = getGameFromGameUuid(msgOb.game_uuid);
                  if(game != null && game.toPlayer == client.uuid) {
                    game.startGame();
                    game.toPlayer.client.emit(PLAYER_INFO,JSON.string({
                      "action" : "start_game",
                      "game_uuid" : game.uuid
                    }));
                    game.fromPlayer.client.emit(PLAYER_INFO,JSON.string({
                      "action" : "start_game",
                      "game_uuid" : game.uuid
                    }));

                    //TODO GAME START
                  }
                } else if (msgOb.status == "denied") {
                  //find game with this id
                  var game = getGameFromGameUuid(msgOb.game_uuid);
                  //check to_uuid is correct
                  console.log("response to play player [" + game.fromPlayeruuid + "] [" + client.uuid + "]");
                  if(game != null && game.toUuid == client.uuid) {
                    //forward back to fromUserUUid
                    game.fromPlayer.client.emit(PLAYER_INFO, msg);
                    //remove game related to uuid
                    games = games.filter(function(e) {
                      return e.uuid != msgOb.game_uuid;
                    });
                  }
                }
                break;
              case "direction":
                console.log("direction for game");
                var game = getGameFromGameUuid(msgOb.game_uuid);
                if(game != null) {
                  game.updatePlayer(msgOb, client.uuid);
                }
                break;
              case "space_bar":
                console.log("space bar hit");
                var game = getGameFromGameUuid(msgOb.game_uuid);
                if(game != null) {
                  game.spaceBar(client.uuid);
                }
                break;
              case "link_level":
                console.log("received link level");
                var game = getGameFromGameUuid(msgOb.game_uuid);
                if(game != null) {
                  game.linkLevel(msgOb, client.uuid);
                }
            };
        });

        //Useful to know when someone connects
        console.log('\t socket.io:: player ' + client.uuid + ' connected');
        
        //When this client disconnects
        client.on('disconnect', function () {
            //Useful to know when someone disconnects
            console.log('\t socket.io:: client disconnected ' + client.uuid );
            //TODO: FIX this up
            //Remove player from uList
            playerDisconnect(client.uuid);
        }); //client.on disconnect
    }); //sio.sockets.on connection