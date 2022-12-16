const fs = require('fs');

var newCards = {};

var rawData = fs.readFileSync('2047card.json');
var cardList = JSON.parse(rawData);

var rawData2 = fs.readFileSync('card_comments.json');
var cardComments = JSON.parse(rawData2);

for (var i=0;i<cardList.length;i++){
	if (!("牌面描述" in cardList[i])){
		cardList[i].牌面描述 = '';
	}
	newCards[cardList[i].名称] = cardList[i];
	if (cardList[i].名称 in cardComments){
		newCards[cardList[i].名称].评价 = cardComments[cardList[i].名称];
	}
}
var newData = JSON.stringify(newCards);
fs.writeFileSync('2047_cards.json',newData);