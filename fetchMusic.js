const fetch = require('node-fetch');
const fs = require('fs');

var result = [];
var curr = 0

async function fetchByPage(offset){
	fetch('http://music.eleuu.com/search?keywords='+encodeURI('上海アリス幻樂団')+'&offset='+offset.toString())
    	.then(res => res.json()).catch((e)=>{})
    	.then(json => {
    		if(json.result.songs){
    			result = result.concat(json.result.songs);
    			curr += 30;
    			fetchByPage(curr);
    		}
    		else{
    			extract(result);
    		}
    	}).catch((e)=>{});
}

function extract(songs){
	var result = [];
	for (song of songs){
		if (song.artists.map(a=>a.id).includes(15345)){
			result.push(song.id);
		}
	}
	//console.log(result);
	console.log(Object.keys(result).length); //600
	var text = JSON.stringify(result);
	fs.writeFileSync('touhouMusic.json',text);
}

fetchByPage(curr);