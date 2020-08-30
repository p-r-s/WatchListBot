console.log("bot running");
var Twit = require ('twit');
var config = require ('./config');
const { Autohook } = require('twitter-autohook');
const {MongoClient} = require('mongodb');
var T = new Twit({
	consumer_key: process.env.consumer_key.toString(),
	consumer_secret: process.env.consumer_secret.toString(),
	access_token: process.env.access_token.toString(),
	access_token_secret: process.env.access_token_secret.toString(),
	tweet_mode: 'extended',
	timeout_ms:           60*1000, 
	strictSSL:            true,  
});
const util = require('util');
const request = require ('request');

const userId = '1299017827496714243';
const oAuthConfig = {
  token: process.env.access_token.toString(),
  token_secret: process.env.access_token_secret.toString(),
  consumer_key: process.env.consumer_key.toString(),
  consumer_secret: process.env.consumer_secret.toString(),
};

const post = util.promisify(request.post);

async function connectDb() {
	const uri = "mongodb+srv://Pooja:45WrnMJqZycpY8Dc@clustertwiter.f1rv2.mongodb.net/watchlist_twitter?retryWrites=true&w=majority";
	const client = new MongoClient(uri,{ useNewUrlParser: true, useUnifiedTopology: true} );
	try {
    await client.connect();
	// set up web hook
	await setWebhook(client);
    //await listDatabases(client);
 
} catch (e) {
    console.error(e);
}
}



async function setWebhook(client) {
	const webhook = new Autohook({
	token: config.access_token ,
	token_secret: config.access_token_secret,
	consumer_key: config.consumer_key,
	consumer_secret: config.consumer_secret,
	env: 'prod',
	port: 1337
  });
  
  // Removes existing webhooks
  await webhook.removeWebhooks();
  
  // Listens to incoming activity
  webhook.on('event',  async event => {
	  /*if (event.user_has_blocked == false) {
		 // T.post('statuses/update', { status: '@'+ event.tweet_create_events[0].user. screen_name + ' Hi! My name is twitter bot :)'  }, function(err, data, response) {
		//console.log(data)
	  //})
	  //console.log(event.tweet_create_events[0].in_reply_to_status_id_str);
		T.get('statuses/show', {id:event.tweet_create_events[0].in_reply_to_status_id_str}, function(err, data, response) {
		
		console.log('Pic\n', data.extended_entities.media[0]);
		console.log('Pic\n', data.extended_entities.media[1]);
		console.log('Pic\n',data.extended_entities.media[2]);
		console.log('Pic\n',data.extended_entities.media[3]);
		});	
	 }	*/
		
		if (event.direct_message_events) {
			await DM(event, client);
		}
		else if (event.user_has_blocked == false) {
			
			await mention(event, client);
		}
		
  });
  
  // Starts a server and adds a new webhook
  await webhook.start();
  
  // Subscribes to a user's activity
  await webhook.subscribe({oauth_token: config.access_token, oauth_token_secret: config.access_token_secret});
}

async function mention (event, client) {
	console.log('here');
	const mentionRegExp = /@WatchListBot/; 
	const message = event.tweet_create_events.shift();
	let messageText = null; 
	if (message.text.trim().split(mentionRegExp)[1]) {
		messageText = message.text.trim().split(mentionRegExp)[1].trim();
	}
	const senderScreenName = message.user.screen_name;
	const replyId = message.id_str; 
	//console.log(message.text, messageText, senderScreenName);
	if (messageText) {
	if (equalsIgnoreCase(messageText, "watchlist")||equalsIgnoreCase(messageText, "list")) {
	await displayWatchList(senderScreenName, client, message, replyId);
  }
  else {
	const regexpDel = /^delete |^del |^d /i;
	const regexpAdd = /^add /i;
	
	
	const del = messageText.split(regexpDel);
	console.log('DEL', del);
	if (del[0] == "") {
	//They want to delete whatever comes in delStr
		await deleteMovie (del[1], senderScreenName, client, message, replyId);
	}
	else {
		const add = messageText.split(regexpAdd);
		if (add[0] == "" ) {	  
			await addMovie(add[1], senderScreenName, client, message, replyId);
		}
		else {
			await addMovie(messageText, senderScreenName, client, message, replyId);
		}	
	}
  }
}
else {
	const replyTweet = message.in_reply_to_status_id_str;
	const regexpLink = / (?:https?|ftp):\/\/[\n\S]+/g;
	const regexpPicLink = / pic.twittter.com\/[\n\S]+/ 
		T.get('statuses/show', {id:replyTweet}, function(err, data, response) {
		if (data){
		console.log(data);
		if (data.text.match(regexpLink)) {
			const addStr = data.text.split(regexpLink)[0];
			console.log(addStr);
			addMovieReply(addStr, senderScreenName, client, replyId);		
		}
		else {
			const addStr = data.text.split(regexpPicLink)[0]
			console.log(addStr);
			addMovieReply(addStr, senderScreenName, client, replyId);
		}
		
		
		}
		else if (err) {
			console.error(err);
		}
		
	});
	
}
}


async function addMovieReply(addStr, senderScreenName, client, replyId) {
	console.log('here');
	let year = "";
	let dir = "";
	let movie = "";
	
	const regexpYear = /\([0-9]+\)/;
	const regexpDir = /dir | dir. | dir. |dir.|dir. /i;

	
	if (addStr.match(regexpYear)) {
			year = addStr.match(regexpYear)[0].trim();
			movie = addStr.split(regexpYear)[0].trim();
		}
		if (addStr.match(regexpDir)) {
			dir = addStr.split(regexpDir)[1].trim();
			if (movie == "") {
				movie = addStr.split(regexpDir)[0].trim();
			}
		}
		if (movie == "") {
			movie = addStr.trim();
		}
		let str = "";
		console.log('Adding', movie);
		if (movie == "") {
			str = "Cannot insert empty movie. Try again!";
		}
		else {
			if (dir != "" && year != "") {
				console.log('here1');
				const result = await client.db('watchlist_twitter').collection('twitterbot').find({handle: senderScreenName, name: movie, year: year, dir:dir}).toArray();
				if (result.length == 0) { 
					await client.db('watchlist_twitter').collection('twitterbot').insertOne({handle: senderScreenName, name: movie, year: year, dir:dir});
					str = 'Added ' + movie + ' ' + year + ' dir. ' + dir + ' to your watchlist';
				}
				else {
					str = 'Good news: You already have that on your watchlist!';
				}
			}
			else if (dir != "") {
				console.log('here2');
				const result = await client.db('watchlist_twitter').collection('twitterbot').find({handle: senderScreenName, name: movie, dir: dir}).toArray();
				if (result.length == 0) { 
					await client.db('watchlist_twitter').collection('twitterbot').insertOne({handle: senderScreenName, name: movie, dir: dir});
					str = 'Added ' + movie + ' dir. ' + dir + ' to your watchlist';
				}
				else {
					str = 'Good news: You already have that on your watchlist!';
				}
			}
			else if (year != "") {
				console.log('here3');
				const result = await client.db('watchlist_twitter').collection('twitterbot').find({handle: senderScreenName, name: movie, year: year}).toArray();
				if (result.length == 0) { 
					await client.db('watchlist_twitter').collection('twitterbot').insertOne({handle: senderScreenName, name: movie, year: year});
					str = 'Added ' + movie + ' ' + year + ' to your watchlist';
				}
				else {
					str = 'Good news: You already have that on your watchlist!';
				}
			}
			else {
				console.log('here4');
				const result = await client.db('watchlist_twitter').collection('twitterbot').find({handle: senderScreenName, name: movie}).toArray();
				if (result.length == 0) { 
					await client.db('watchlist_twitter').collection('twitterbot').insertOne({handle: senderScreenName, name: movie});
					str = 'Added ' + movie +  ' to your watchlist';
				}
				else {
					str = 'Good news: You already have that on your watchlist!'
				}
			}
		}
		const reply = '@' + senderScreenName + ' ' + str; 
			T.post('statuses/update', { status: reply, in_reply_to_status_id: replyId }, function(err, data, response) {
			if (data){
			console.log(data);
			}
			else {
				console.error(err);
			}
		});
}

async function DM(event, client) {
  // Messages are wrapped in an array, so we'll extract the first element
  const message = event.direct_message_events.shift();
  console.log(message);

  // We check that the message is valid
  if (typeof message === 'undefined' || typeof message.message_create === 'undefined') {
    return;
  }
 
  // We filter out message you send, to avoid an infinite loop
  if (message.message_create.sender_id === message.message_create.target.recipient_id) {
    return;
  }
  
  if (message.message_create.sender_id == userId) {
	  return;
  }
  
  const senderScreenName = event.users[message.message_create.sender_id].screen_name;
  const messageText = message.message_create.message_data.text.trim();
  
  //Display list
  if (equalsIgnoreCase(messageText, "watchlist")||equalsIgnoreCase(messageText, "list")) {
	await displayWatchList(senderScreenName, client, message, false);
  }
  else {
	const regexpDel = /^delete |^del |^d /i;
	const regexpAdd = /^add /i;
	
	
	const del = messageText.split(regexpDel);
	if (del[0] == "") {
	//They want to delete whatever comes in delStr
		await deleteMovie (del[1], senderScreenName, client, message, false);
	}
	else {
		const add = messageText.split(regexpAdd);
		console.log('here');
		if (add[0] == "") {	  
			await addMovie(add[1], senderScreenName, client, message, false);
		}
		else {
			await addMovie(messageText, senderScreenName, client, message, false);
		}	
	}
  }
}

function equalsIgnoreCase(str1, str2) {
	return str1.toUpperCase() === str2.toUpperCase();
}

async function displayWatchList(senderScreenName, client, message, replyId) {
	console.log("Displaying list");
	const res = await client.db('watchlist_twitter').collection('twitterbot').find({handle: senderScreenName}).toArray();
	let list = "";
	if (res.length != 0) {
	for(const item of res) {
		let str = item.name; 
		if (typeof item.year != 'undefined' && item.year != "") {
			str += ' ' + item.year;
		}
		if (typeof item.dir != 'undefined' && item.dir != "") {
			str += ' dir. ' + item.dir;
		}
		list += str + '\n';
	}
	}
	else {
		list = "Nothing to watch here! Add a movie by sending me it's name :D";
	}
	if (!replyId) {
	 const requestConfig = {
		url: 'https://api.twitter.com/1.1/direct_messages/events/new.json',
		oauth: oAuthConfig,
		json: {
			event: {
				type: 'message_create',
				message_create: {
					target: {
						recipient_id: message.message_create.sender_id,
					},
					message_data: {
						text: list,
					},
				},
			},
		},
	};
	await post(requestConfig);
	}
	else {
		const reply = '@' + senderScreenName + '\n' + list; 
		T.post('statuses/update', { status: reply, in_reply_to_status_id: replyId }, function(err, data, response) {
			if (data){
			console.log(data);
			}
			else {
				console.error(err);
			}
		});
	}
	return;
}

async function deleteMovie(delStr, senderScreenName, client, message, replyId) {
	let year = "";
	let dir = "";
	let movie = "";
	
	const regexpYear = /\([0-9]+\)/;
	const regexpDir = /dir | dir. | dir. |dir.|dir. | \- /i;
	
	if (delStr.match(regexpYear)) {
		 year = delStr.match(regexpYear)[0].trim();
		 movie = delStr.split(regexpYear)[0].trim();
	}
	if (delStr.match(regexpDir)) {
		dir = delStr.split(regexpDir)[1].trim();
		if (movie == "") {
			movie = delStr.split(regexpDir)[0].trim();
		}
	}
	if (movie == "") {
		movie = delStr.trim();
	}
	let str = "";
		if (movie == "") {
			str = "Cannot delete empty movie. Try again!";
		}
		else {
			if (year != "" && dir != "") {
				//User has provided all details. Delete directly
				const res = await client.db('watchlist_twitter').collection('twitterbot').deleteOne({handle: senderScreenName, name: movie, year: year, dir: dir});
				console.log('Delete Res: ', res.deletedCount);
				if (res.deletedCount == 0) {
					str = 'I could not find that :( send watchlist or list to view your watchlist';
				}
				else {
					str = 'Deleted ' + movie + year + ' dir. ' + dir + ' from your watchlist';
				}
				//Check for error
			}
			else {
				//User has either supplied year, dir, or none
				if (year != "") {
					const res = await client.db('watchlist_twitter').collection('twitterbot').find({handle: senderScreenName, name:movie, year: year}).toArray();
					console.log('Find Res: ', res);
					if (res.length == 0) {
						str = 'I could not find that :( send watchlist or list to view your watchlist';
					}
					else if (res.length == 1) {
						//There is only one matching result
						const res = await client.db('watchlist_twitter').collection('twitterbot').deleteOne({handle: senderScreenName, name: movie, year: year});
						str = 'Deleted ' + movie + ' ' +  year + ' from your watchlist';
						//Check for error
					}
					else {
						//I need the director as well
						str = 'I found multiple matching movies :( \nPlease supply a director name in your command in the format: delete <movie> <(year)> dir. <director>';
					}
				}
				else if (dir != "") {
					const res = await client.db('watchlist_twitter').collection('twitterbot').find({handle: senderScreenName, name:movie, dir: dir}).toArray();
					console.log('Find Res: ', res);
					if (res.length == 0) {
						str = 'I could not find that :( send watchlist or list to view your watchlist';
					}
					else if (res.length == 1) {
						//There is only one matching result
						const res = await client.db('watchlist_twitter').collection('twitterbot').deleteOne({handle: senderScreenName, name: movie, dir: dir});
						str = 'Deleted ' + movie + ' dir. ' + dir + ' from your watchlist';
						//Check for error
					}
					else {
						//I need the director as well
						str = 'I found multiple matching movies :( \nPlease supply a year in your command in the format: delete <movie> <(year)> dir. <director>';
					}
				}
				else {
					//Didn't provide either 
					const res = await client.db('watchlist_twitter').collection('twitterbot').find({handle: senderScreenName, name:movie}).toArray();
					console.log('Find Res: ', res.length);
					if (res.length == 0) {
						str = 'I could not find that :( send watchlist or list to view your watchlist';
					}
					else if (res.length == 1) {
						//There is only one matching result
						const res = await client.db('watchlist_twitter').collection('twitterbot').deleteOne({handle: senderScreenName, name: movie});
						str = 'Deleted ' + movie + ' from your watchlist';
						//Check for error
					}
					else {
						//I need the director as well
						str = 'I found multiple matching movies :( \nPlease supply a year and/or a director name in your command in the format: delete <movie> <(year)> dir. <director>';
					}
				}
		
			}
		}
	
	//check if dir or movie is empty
	
	console.log('Deleting', movie, year, dir);
	//Try to find just the movie. If there are multiple, then go by either year or dir
	if (!replyId) {
	 const requestConfig = {
		url: 'https://api.twitter.com/1.1/direct_messages/events/new.json',
		oauth: oAuthConfig,
		json: {
			event: {
				type: 'message_create',
				message_create: {
					target: {
						recipient_id: message.message_create.sender_id,
					},
					message_data: {
						text: str,
					},
				},
			},
		},
	};
    await post(requestConfig);
	}
	else {
		const reply = '@' + senderScreenName + ' ' + str; 
		T.post('statuses/update', { status: reply, in_reply_to_status_id: replyId }, function(err, data, response) {
			if (data) {
			console.log(data);
			}
			else {
				console.error(err);
			}
		});
	}
	
}

async function addMovie (addStr, senderScreenName, client, message, replyId) {
	console.log('add function');
	let year = "";
	let dir = "";
	let movie = "";
	
	const regexpYear = /\([0-9]+\)/;
	const regexpDir = /dir | dir. | dir. |dir.|dir. /i;;
	
	if (addStr.match(regexpYear)) {
			year = addStr.match(regexpYear)[0].trim();
			movie = addStr.split(regexpYear)[0].trim();
		}
		if (addStr.match(regexpDir)) {
			dir = addStr.split(regexpDir)[1].trim();
			if (movie == "") {
				movie = addStr.split(regexpDir)[0].trim();
			}
		}
		if (movie == "") {
			movie = addStr.trim();
		}
		let str = "";
		console.log('Adding', movie);
		if (movie == "") {
			str = "Cannot insert empty movie. Try again!";
		}
		else {
			if (dir != "" && year != "") {
				console.log('here1');
				const result = await client.db('watchlist_twitter').collection('twitterbot').find({handle: senderScreenName, name: movie, year: year, dir:dir}).toArray();
				if (result.length == 0) { 
					await client.db('watchlist_twitter').collection('twitterbot').insertOne({handle: senderScreenName, name: movie, year: year, dir:dir});
					str = 'Added ' + movie + ' ' + year + ' dir. ' + dir + ' to your watchlist';
				}
				else {
					str = 'Good news: You already have that on your watchlist!';
				}
			}
			else if (dir != "") {
				console.log('here2');
				const result = await client.db('watchlist_twitter').collection('twitterbot').find({handle: senderScreenName, name: movie, dir: dir}).toArray();
				if (result.length == 0) { 
					await client.db('watchlist_twitter').collection('twitterbot').insertOne({handle: senderScreenName, name: movie, dir: dir});
					str = 'Added ' + movie + ' dir. ' + dir + ' to your watchlist';
				}
				else {
					str = 'Good news: You already have that on your watchlist!';
				}
			}
			else if (year != "") {
				console.log('here3');
				const result = await client.db('watchlist_twitter').collection('twitterbot').find({handle: senderScreenName, name: movie, year: year}).toArray();
				if (result.length == 0) { 
					await client.db('watchlist_twitter').collection('twitterbot').insertOne({handle: senderScreenName, name: movie, year: year});
					str = 'Added ' + movie + ' ' + year + ' to your watchlist';
				}
				else {
					str = 'Good news: You already have that on your watchlist!';
				}
			}
			else {
				console.log('here4');
				const result = await client.db('watchlist_twitter').collection('twitterbot').find({handle: senderScreenName, name: movie}).toArray();
				if (result.length == 0) { 
					await client.db('watchlist_twitter').collection('twitterbot').insertOne({handle: senderScreenName, name: movie});
					str = 'Added ' + movie +  ' to your watchlist';
				}
				else {
					str = 'Good news: You already have that on your watchlist!'
				}
			}
		}
		if (!replyId) {
		const requestConfig = {
			url: 'https://api.twitter.com/1.1/direct_messages/events/new.json',
			oauth: oAuthConfig,
			json: {
				event: {
					type: 'message_create',
					message_create: {
						target: {
							recipient_id: message.message_create.sender_id,
						},
						message_data: {
							text: str,
						},
					},
				},
			},
		};
		await post(requestConfig);
		}
		else {
			const reply = '@' + senderScreenName + ' ' + str; 
			T.post('statuses/update', { status: reply, in_reply_to_status_id: replyId }, function(err, data, response) {
			if (data) {
			console.log(data);
			}
			else {
				console.error(err);
			}
		});
		}
	
}


connectDb().catch(console.error);


/*(async () => {
  const webhook = new Autohook({
	token: config.access_token ,
	token_secret: config.access_token_secret,
	consumer_key: config.consumer_key,
	consumer_secret: config.consumer_secret,
	env: 'prod',
	port: 1337
  });
  
  // Removes existing webhooks
  await webhook.removeWebhooks();
  
  // Listens to incoming activity
  webhook.on('event',  event => {
	  if (event.user_has_blocked == false) {
		 // T.post('statuses/update', { status: '@'+ event.tweet_create_events[0].user. screen_name + ' Hi! My name is twitter bot :)'  }, function(err, data, response) {
		//console.log(data)
	  //})
	  //console.log(event.tweet_create_events[0].in_reply_to_status_id_str);
		T.get('statuses/show', {id:event.tweet_create_events[0].in_reply_to_status_id_str}, function(err, data, response) {
		
		console.log('Pic\n', data.extended_entities.media[0]);
		console.log('Pic\n', data.extended_entities.media[1]);
		console.log('Pic\n',data.extended_entities.media[2]);
		console.log('Pic\n',data.extended_entities.media[3]);
		});
		
		
	 }		  

  });
  
  
  // Starts a server and adds a new webhook
  await webhook.start();
  
  // Subscribes to a user's activity
  await webhook.subscribe({oauth_token: config.access_token, oauth_token_secret: config.access_token_secret});
})();
*/



