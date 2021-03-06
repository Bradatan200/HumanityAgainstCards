const RequestHeaders = {
    REQUEST_ID: 1,
    RESPONSE_REQUEST_ID:2,
    REQUEST_BEGIN_GAME:3,
    RESPONSE_BEGIN_GAME:4,
    REQUEST_CHOSE_CARD:5,
    RESPONSE_CHOSE_CARD:6,
    REQUEST_BLACK_CARD:7, //redundant
    RESPONSE_BLACK_CARD:8, //redundant
    REQUEST_WAIT_ENDED_PLAYERS: 9,
    RESPONSE_WAIT_ENDED_PLAYERS: 10,
    REQUEST_WAIT_ENDED_CZAR: 11,
    RESPONSE_WAIT_ENDED_CZAR: 12,
    REQUEST_BEGIN_NEW_ROUND: 13,
    RESPONSE_BEGIN_NEW_ROUND: 14,
    REQUEST_UPDATE_POINTS: 15,
    RESPONSE_UPDATE_POINTS: 16,
    REQUEST_CHECK_WINNER: 17,
    RESPONSE_CHECK_WINNER: 18,
    REQUEST_WHITE_CARD: 19,
    RESPONSE_WHITE_CARD: 20
};
Object.freeze(RequestHeaders);

const GameStates = {
    INITIAL:0,
    CHOOSE_WHITE_CARD:1,
    CHOSEN_WHITE_CARD:2,
    CHOOSE_BLACK_CARD:3,
    CHOSEN_BLACK_CARD:4,
    WAIT_FOR_PLAYERS:5,
    WAIT_FOR_CZAR:6,
    ENDED_WAIT_FOR_PLAYERS:7, //redundant
    END_ROUND:8,
    CHECK_WINNER: 9,
    NEW_ROUND:10,
    NEW_ROUND_FOR_PLAYER: 11,
    GAME_END:12
};

const PlayerTypes = {
    CZAR: 0,
    PLAYER: 1,
};


class Card {
    constructor(id, name, text) {
        this.id = id;
        this.name = name;
        this.text = text;
    }
}

//Only used for arrays
class Player {
    constructor(id) {
        this.id = id;
        this.name = '';
        this.points = 0;
    }
}

/** Momentan reprezinta un singur joc, e treaba backend-ului sa aiba grija de apelurile catre fiecare obiect GameManager sa fie facut corect */
class GameManager {
    constructor() { //should actually be initialized with a gameId, created by looking at the db, assuring it is unique
        this.waitEnded_Players = true; //this should be false
        this.waitEnded_Czar = true; //this should be false

        this.playerCount = 0;
        this.readyPlayers = 0;
        this.playerList = [];

        this.commonBlackCard = null; //card generated by server
        this.selectedWhiteCards = []; //cards selected by normal players
        this.winningCard = null; //card chosen by czar
        this.winnerPlayer = null;

        this.maxPoints = 2; //2 is set just for cycle preview -- use higher values

    }

    newId(){
        if (this.counter === undefined){
            this.counter = 0;
        }
        return this.counter++;
    }

    resetData(){
        this.readyPlayers = 0;
        this.selectedWhiteCards = [];
        this.winningCard = null;
        this.waitEnded_Players = false;
        this.waitEnded_Czar = false;
    }

    response(data){
        /**
         * Add players to the game and give them a temporary id
         */
        if (data.header === RequestHeaders.REQUEST_ID){
            this.playerCount++; //based on this request we determine how many players are there
            let id_new = this.newId();

            //WARNING: player id might not match -- client creates its own id using its own constructor
            this.playerList.push(new Player(id_new));
            this.playerList.push(new Player(this.newId())); //only for cycle preview

            console.log('[SERVER] Created new id');
            return {
                header: RequestHeaders.RESPONSE_REQUEST_ID,
                id: id_new
            }
        }

        /**
         * Give the player a set of white cards, the common black card, player list and whoever is the czar
         */
        if (data.header === RequestHeaders.REQUEST_BEGIN_GAME){
            console.log('[SERVER] Client has begun game');
            let card_lst = []; //these are random but they need to be taken from a db
            [...Array(10).keys()].forEach((x) => card_lst.push(new Card(x, getRandomString(), getRandomString())));
            return {
                header: RequestHeaders.RESPONSE_BEGIN_GAME,
                cards: card_lst,
                black_card: new Card(999, 'Black Card', 'Some black card text'),
                player_list: this.playerList,
                current_czar: 0 //index for player list - should be random initially
            };
        }

        /**
         * After a player chose a card, add the card to the list,
         * count how many players are ready and send which wait ended
         */
        if(data.header === RequestHeaders.REQUEST_CHOSE_CARD){
            console.log('[SERVER] Client chose card id: ', data.card_id);
            this.readyPlayers++;

            if(this.readyPlayers === this.playerCount - 1){
                this.waitEnded_Players = true;
            }
            else if(this.readyPlayers === this.playerCount){
                this.waitEnded_Czar = true;
            }

            if(data.player_type === PlayerTypes.PLAYER){
                this.selectedWhiteCards.push(data.card_id);
            } else {
                this.winningCard = data.card_id;
            }

            return {
                header: RequestHeaders.RESPONSE_CHOSE_CARD,
                card_id: data.card_id
            }
        }

        /**
         * Wait ended for players, send czar the selected cards array
         */
        if(data.header === RequestHeaders.REQUEST_WAIT_ENDED_PLAYERS){
            console.log('[SERVER] Client requested game status');
            this.selectedWhiteCards.push(new Card(0, 'White card in selection', 'Cycle preview')); //only for cycle preview
            return {
                header: RequestHeaders.RESPONSE_WAIT_ENDED_PLAYERS,
                selected_cards: this.selectedWhiteCards,
                wait_end: this.waitEnded_Players
            }
        }

        /**
         * Wait ended for czar, send winning card to players
         */
        if(data.header === RequestHeaders.REQUEST_WAIT_ENDED_CZAR){
            console.log('[SERVER] Client requested game status');
            return {
                header: RequestHeaders.RESPONSE_WAIT_ENDED_CZAR,
                wait_end: this.waitEnded_Czar,
                //winning_card: this.winningCard
                winning_card: 0 //only for cycle preview
            }
        }

        /**
         * Update player points and check if he reached max points.
         * If so, set the winner.
         */
        if(data.header === RequestHeaders.REQUEST_UPDATE_POINTS){
            console.log('[SERVER] Client requested points update');
            let playerIndex = this.playerList.findIndex(player => player.id === data.player_id);
            this.playerList[playerIndex].points = data.points;

            if(this.playerList[playerIndex].points >= this.maxPoints){
                this.winnerPlayer = this.playerList[playerIndex];
            }

            return {
                header: RequestHeaders.RESPONSE_UPDATE_POINTS
            }
        }

        /**
         * Returns the winning player (null if no one won yet) and the player list
         * with updated scores. We update the 'blackCardGenerated' flag here so that
         * in case of a new round, it won't be generated multiple times.
         */
        if(data.header === RequestHeaders.REQUEST_CHECK_WINNER){
            console.log('[SERVER] Client requested winner');
            this.blackCardGenerated = false;
            return {
                header: RequestHeaders.RESPONSE_CHECK_WINNER,
                winner_player: this.winnerPlayer,
                player_list: this.playerList
            }
        }


        /**
         * Send the black card on new round.
         */
        if (data.header === RequestHeaders.REQUEST_BEGIN_NEW_ROUND){
            console.log('[SERVER] Client has begun new round');
            this.resetData();
            this.waitEnded_Players = true; //only for cycle preview
            this.waitEnded_Czar = true; //only for cycle preview
            if(this.blackCardGenerated === false) {
                this.commonBlackCard = new Card(999, 'Black Card', 'Some black card text'); // card should be random
                this.blackCardGenerated = true;
            }

            return {
                header: RequestHeaders.RESPONSE_BEGIN_NEW_ROUND,
                black_card: this.commonBlackCard,
            }
        }

        /**
         * Send a white card
         */
        if (data.header === RequestHeaders.REQUEST_WHITE_CARD){
            console.log('[SERVER] Client requested white card');
            return {
                header: RequestHeaders.RESPONSE_WHITE_CARD,
                white_card: new Card(555, 'Whtie card', 'Something...') // card should be random
            }
        }


        return 'error';
    }
}

class GameClient {
    constructor(token) {
        //WARNING: player id might not match -- game manager generates an id for the player
        this.id = token;

        this.cards = [];
        this.selectedWhiteCards = []; //cards selected by normal players
        this.commonBlackCard = null;
        this.winningCard = null;

        this.points = 0;
        this.choice = -1; //id of the selected card
        this.type = PlayerTypes.PLAYER;

        this.playerList = [];
        this.currentCzarIndex = null;
        this.winnerPlayer = null;

        this.state = null;
    }

    update(data){//this will return maybe a response with accepted/invalid
        if (this.state === GameStates.CHOOSE_WHITE_CARD){
            console.log('Choosing white card');
            this.choice = data.card_id;
            this.state = GameStates.CHOSEN_WHITE_CARD;
        }

        if (this.state === GameStates.END_ROUND){
            console.log('Round ended');
        }

        if (this.state === GameStates.WAIT_FOR_PLAYERS){
            console.log('Waiting for other normal players to choose card');
        }

        if (this.state === GameStates.WAIT_FOR_CZAR){
            console.log('Waiting for czar to choose card');
        }

        if (this.state === GameStates.NEW_ROUND){
            console.log('Started a new round');
        }

        if (this.state === GameStates.GAME_END){
            console.log('Game has ended');
        }


    }

    getNecessaryData(){
        if(this.state === null){
            return {
                header: null //RequestHeaders.REQUEST_ID -- Commented out because it's already requested in index.js
            }
        }

        if (this.state === GameStates.INITIAL) {
            return {
                header: RequestHeaders.REQUEST_BEGIN_GAME
            }
        }

        if (this.state === GameStates.CHOSEN_WHITE_CARD){
            return {
                header: RequestHeaders.REQUEST_CHOSE_CARD,
                card_id: this.choice,
                player_type: this.type
            }
        }

        if (this.state === GameStates.WAIT_FOR_PLAYERS){
            return {
                header: RequestHeaders.REQUEST_WAIT_ENDED_PLAYERS
            }
        }

        if (this.state === GameStates.WAIT_FOR_CZAR) {
            return {
                header: RequestHeaders.REQUEST_WAIT_ENDED_CZAR
            }
        }

        if(this.state === GameStates.END_ROUND) {
            return {
                header: RequestHeaders.REQUEST_UPDATE_POINTS,
                player_id: this.id,
                points: this.points
            }
        }

        if(this.state === GameStates.CHECK_WINNER) {
            return {
                header: RequestHeaders.REQUEST_CHECK_WINNER
            }
        }

        if(this.state === GameStates.NEW_ROUND){
            return {
                header: RequestHeaders.REQUEST_BEGIN_NEW_ROUND
            }
        }


        if(this.state === GameStates.NEW_ROUND_FOR_PLAYER){
            return {
                header: RequestHeaders.REQUEST_WHITE_CARD
            }
        }


        return 'error';
    }

    putData (data){
        /**
         * This if was supposed to receive a temp id from server
         * but the id is already requested in index.js
         */
        if (this.state === null){ //&& data.header === RequestHeaders.RESPONSE_REQUEST_ID){
            //this.id = data.id; -- id is set by constructor
            this.state = GameStates.INITIAL;
            return{
                header: 'id_response'
            }
        }


        /**
         * Init white cards, black card, player list and type
         */
        if (this.state === GameStates.INITIAL && data.header === RequestHeaders.RESPONSE_BEGIN_GAME) {
            console.log('Received cards:', data.cards);
            this.cards = data.cards;
            this.commonBlackCard = data.black_card;
            this.playerList = data.player_list;
            this.currentCzarIndex = data.current_czar;

            if(this.playerList[this.currentCzarIndex].id === this.id)
                this.type = PlayerTypes.CZAR;

            if(this.type === PlayerTypes.PLAYER) {
                this.state = GameStates.CHOOSE_WHITE_CARD;
            } else {
                this.state = GameStates.WAIT_FOR_PLAYERS;
            }
            return {
                header:'show_cards',
                cards: this.cards,
                black_card: this.commonBlackCard,
                player_list: this.playerList

            }
        }

        /**
         * White card choice behavior. If czar picks white, end round for czar.
         * If normal player picks white, remove card from list and set state to wait.
         */
        if(this.state === GameStates.CHOSEN_WHITE_CARD && data.header === RequestHeaders.RESPONSE_CHOSE_CARD){
            console.log('Player has chosen card id: ', data.card_id);
            if(this.type === PlayerTypes.PLAYER) {
                this.cards = this.cards.filter(card => card.id !== data.card_id); //remove the card that was selected
                this.state = GameStates.WAIT_FOR_CZAR;
            } else {
                this.state = GameStates.END_ROUND;
            }
            return {
                header: 'white_card_choice',
                card_id: data.card_id
            }

        }

        /**
         * When players are all ready, czar must choose a white card.
         * Also receive the array with cards that the players chose.
         */
        if(this.state === GameStates.WAIT_FOR_PLAYERS && data.header === RequestHeaders.RESPONSE_WAIT_ENDED_PLAYERS){
            console.log('Wait ended for czar, time to choose white card');
            if(data.wait_end === true){
                this.state = GameStates.CHOOSE_WHITE_CARD;
                this.selectedWhiteCards = data.selected_cards;
            }
            return {
                header: 'czar_allow_white_card_choice',
                selected_cards: this.selectedWhiteCards
            }
        }

        /**
         * When czar has chosen the card, end round for player and show him the winning card.
         * If the player choice is the winning card, then give him a point.
         */
        if(this.state === GameStates.WAIT_FOR_CZAR && data.header === RequestHeaders.RESPONSE_WAIT_ENDED_CZAR){
            console.log('Wait ended for normal players, time to end round');
            if(data.wait_end === true) {
                this.state = GameStates.END_ROUND;
                this.winningCard = data.winning_card;

                if(this.choice === this.winningCard){
                    this.points++;
                }
            }
            return {
                header: 'player_round_end',
                winning_card: this.winningCard
            }
        }

        /**
         * After all players updated the points, we need to check if anyone won.
         */
        if(this.state === GameStates.END_ROUND && data.header === RequestHeaders.RESPONSE_UPDATE_POINTS){
            this.state = GameStates.CHECK_WINNER;
            return {
                header: 'points_update',

            }
        }

        /**
         * If no one won, request a new round otherwise end the game
         */
        if(this.state === GameStates.CHECK_WINNER && data.header === RequestHeaders.RESPONSE_CHECK_WINNER){
            if(data.winner_player === null){
                this.playerList = data.player_list;
                this.state = GameStates.NEW_ROUND;
            }
            else{
                this.winnerPlayer = data.winner_player;
                this.state = GameStates.GAME_END;
            }
            return {
                header: 'display_winner',
                player_list: this.playerList,
                winner: this.winnerPlayer
            }
        }

        /**
         * Set new czar(next player in the list) and receive black card.
         */
        if(this.state === GameStates.NEW_ROUND && data.header === RequestHeaders.RESPONSE_BEGIN_NEW_ROUND) {
            this.choice = -1;
            this.selectedWhiteCards = [];
            this.commonBlackCard = data.black_card;
            //this.currentCzarIndex++;
            //the following if + else should be removed, it's just used to preview the game cycle
            if(this.currentCzarIndex === 0)
                this.currentCzarIndex = 1;
            else
                this.currentCzarIndex = 0;

            if(this.playerList[this.currentCzarIndex].id === this.id) {
                this.type = PlayerTypes.CZAR;
            } else {
                this.type = PlayerTypes.PLAYER;
            }

            if(this.type === PlayerTypes.CZAR) {
                this.state = GameStates.WAIT_FOR_PLAYERS;
            } else {
                this.state = GameStates.NEW_ROUND_FOR_PLAYER;
            }


            return {
                header:'new_round',
                cards: this.cards,
                black_card: this.commonBlackCard
            }
        }

        /**
         * After normal player receives a white card, set state to choose
         */
        if(this.state === GameStates.NEW_ROUND_FOR_PLAYER && data.header === RequestHeaders.RESPONSE_WHITE_CARD) {
            this.cards.push(data.white_card);
            this.state = GameStates.CHOOSE_WHITE_CARD;

            return{
                header: 'new_round_for_normal_player'
            }
        }

        if(this.state === GameStates.GAME_END) {
            return{
                header: 'game_end'
            }
        }
        return 'error';
    }
}

function getRandomString() {
    return Array(1).fill(null).map(() => Math.random().toString(36).substr(2)).join('')
}


// module.exports.[ce nume vrei sa aibe in afara filei] = [variabila/functia/clasa din fila]
module.exports.RequestHeaders = RequestHeaders;
module.exports.GameStates = GameStates;
module.exports.Card = Card;
module.exports.GameManager = GameManager;
module.exports.GameClient = GameClient;
module.exports.getRandomString= getRandomString;
