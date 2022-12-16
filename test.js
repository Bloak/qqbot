const fs = require('fs');

var reply = '';

var message = '能耗=3&力量=8';
message += '&';
var rawData = fs.readFileSync('2047_cards.json');
var cards = JSON.parse(rawData);
var temp = ['','',''];
var s = 0;
for (var i=0;i<message.length;i++){
    if (!('&={'.includes(message[i]))){
        temp[s] += message[i];
    }
    else if ('={'.includes(message[i])){
        temp[1] = message[i];
        s = 2;
    }
    else {
    	console.log(temp);
        for (var name in cards){
            if (temp[0] in cards[name]){
                if (temp[1]==='='){
                    if (cards[name][temp[0]]===temp[2]){
                        //pass test
                    }
                    else {
                        delete cards[name]
                    }
                }
                else {
                    if (cards[name][temp[0]].includes(temp[2])){
                        //pass test
                    }
                    else {
                        delete cards[name];
                    }
                }
            }
            else {
                delete cards[name];
            }
        }
        temp = ['','',''];
        s = 0;
    }
}
var cardNames = Object.keys(cards);
if (cardNames.length > 10){
    for (var j=0;j<10;j++){
        reply += cardNames[j] + ' ';
    }
    reply += `等${cardNames.length}张牌`;
}
else {
    for (var j=0;j<cardNames.length;j++){
        reply += cardNames[j] + ' ';
    }
    reply += `共${cardNames.length}张牌`;
}

console.log(reply);