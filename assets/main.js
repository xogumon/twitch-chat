window.onload = async function () {
	let firstLoad = true;
	const limit = 50;
	const channel = localStorage.getItem("twitch-channel") || "xogum";
	const clientId = localStorage.getItem("twitch-client-id");
	const token = localStorage.getItem("twitch-token");
	const thirdPartyEmotes = {};
	const cachedBadges = {};
	const scroll = () => {
		document.scrollingElement.scrollTop = document.scrollingElement.scrollHeight;
	};
	const htmlEscape = (str) =>
		str.replace(
			/[&<>"'\\]/g,
			(tag) =>
				({
					"&": "&amp;",
					"<": "&lt;",
					">": "&gt;",
					'"': "&quot;",
					"'": "&#39;",
					"\\": "",
				}[tag])
		);
	const regexEscape = (str) => {
		return str.replace(/[-\/\\^$*+?.()|[\]{}]/g, "\\$&");
	};
	const getIndicesOf = (find, str, flags = "g") => {
		const findLen = find.length;
		let match,
			indices = [];
		const regex = new RegExp(regexEscape(find), flags);
		while ((match = regex.exec(str)) !== null) {
			const before = /\s|undefined/.test(str[match.index - 1]);
			const after = /\s|undefined/.test(str[match.index + findLen]);
			if (before && after) {
				indices.push(match.index);
			}
		}
		return indices;
	};
	const isValidURL = (str) => {
		try {
			const regex = new RegExp(
				"^(https?:\\/\\/)?" + // protocol
					"((([a-z\\d]([a-z\\d-]*[a-z\\d])*)\\.)+[a-z]{2,}|" + // domain name
					"((\\d{1,3}\\.){3}\\d{1,3}))" + // OR ip (v4) address
					"(\\:\\d+)?(\\/[-a-z\\d%_.~+]*)*" + // port and path
					"(\\?[;&a-z\\d%_.~+=-]*)?" + // query string
					"(\\#[-a-z\\d_]*)?$",
				"i"
			); // fragment locator
			return !!regex.test(str);
		} catch (e) {
			return false;
		}
	};
	const replaceLinks = (text) => {
		try {
			const sep = " ";
			return text
				.split(sep)
				.map((word) => {
					if (isValidURL(word)) {
						try {
							const url = new URL(!word.startsWith("http") ? `https://${word}` : word);
							return `<a href="${url.href}" target="_blank">${htmlEscape(word)}</a>`;
						} catch (e) {
							return word;
						}
					}
					return word;
				})
				.join(sep);
		} catch (e) {
			return text;
		}
	};
	const strongMentions = (text) => {
		try {
			const regex = /^@[\w]{4,25}$/i;
			const sep = " ";
			return text
				.split(sep)
				.map((word) => {
					if (regex.test(word)) {
						return `<strong>${htmlEscape(word)}</strong>`;
					}
					return word;
				})
				.join(sep);
		} catch (e) {
			return text;
		}
	};
	const timestampToTime = (timestamp, style = "short") => {
		if (typeof timestamp !== "number") timestamp = parseInt(timestamp);
		const date = isNaN(timestamp) ? new Date() : new Date(timestamp);
		return date.toLocaleTimeString("pt-BR", {
			timeZone: "America/Sao_Paulo",
			timeStyle: style,
		});
	};
	const timestampToDate = (timestamp, style = "medium") => {
		if (typeof timestamp !== "number") timestamp = parseInt(timestamp);
		const date = isNaN(timestamp) ? new Date() : new Date(timestamp);
		return date.toLocaleDateString("pt-BR", {
			timeZone: "America/Sao_Paulo",
			dateStyle: style,
		});
	};
	const parseEmotes = (text, emotes) => {
		text = text.split("");
		try {
			emotes.map(([url, indices]) => {
				indices.map((i) => {
					const [start, end] = i.split("-").map((n) => parseInt(n));
					const emoteText = text.slice(start, end + 1).join("");
					const emoteTextEscaped = regexEscape(emoteText);
					const emoteImg = `<img class="emote" src="${url}" alt="${emoteTextEscaped}" title="${emoteTextEscaped}">`;
					const arrayLength = end - start;
					text = text
						.slice(0, start)
						.concat(emoteImg)
						.concat(new Array(arrayLength).fill(""))
						.concat(text.slice(end + 1));
				});
			});
		} catch (e) {
			console.error(e);
		}
		return text.join("");
	};
	const parseMessage = (text, emotes) => {
		const userEmotes = Object.entries(emotes || {})
			.map(([id, indices]) => {
				const url = `https://static-cdn.jtvnw.net/emoticons/v2/${id}/default/dark/1.0`;
				return [url, indices];
			})
			.filter(([, indices]) => indices.length);
		const thirdEmotes = Object.entries(thirdPartyEmotes)
			.map(([name, url]) => {
				const indices = getIndicesOf(name, text).map((i) => [i, i + name.length - 1].join("-"));
				return [url, indices];
			})
			.filter(([, indices]) => {
				if (userEmotes.length) {
					const userEmoteIndices = userEmotes.map(([, indices]) => indices).flat();
					return indices.some((i) => !userEmoteIndices.includes(i));
				}
				return indices.length;
			});
		emotes = [...userEmotes, ...thirdEmotes];
		text = parseEmotes(text, emotes);
		text = strongMentions(text);
		text = replaceLinks(text);
		return text;
	};
	const addMessage = (data) => {
		const messages = Array.from(document.querySelectorAll("#chat .message"));
		if (messages.length > limit) {
			messages.shift().remove();
		}
		const lastMessage = messages.pop();
		const chat = document.querySelector("#chat");
		const div = document.createElement("div");
		div.id =
			data.id === "highlighted-message" ? `highlight-${data["tmi-sent-ts"]}` : `message-${data.id}`;
		div.dataset.id = data.id;
		div.dataset.timestamp = data["tmi-sent-ts"];
		div.dataset.userName = data.username || data["display-name"];
		div.dataset.userId = data["user-id"];
		div.classList.add("message", data["message-type"]);
		if (data.message.split(" ").some((word) => word === new RegExp(`^@?${channel}$`, "i"))) {
			div.classList.add("mention");
		} else if (!lastMessage || lastMessage.classList.contains("even")) {
			div.classList.add("odd");
		} else {
			div.classList.add("even");
		}
		if (data.hasOwnProperty("first-message")) {
			div.classList.add("first-message");
		}
		if (data.hasOwnProperty("reply-parent-msg-id")) {
			const reply = document.createElement("div");
			reply.classList.add("reply-parent");
			reply.innerHTML = `<span class="reply-parent-user">${data["reply-parent-user-name"]}</span> <span class="reply-parent-message">${data["reply-parent-msg-body"]}</span>`;
			div.appendChild(reply);
		}
		div.style.borderLeftColor = data.color;
		const user = document.createElement("span");
		user.classList.add("user");
		const timestamp = document.createElement("span");
		timestamp.classList.add("timestamp");
		timestamp.innerText = timestampToTime(data["tmi-sent-ts"]);
		timestamp.title = timestampToDate(data["tmi-sent-ts"]);
		user.appendChild(timestamp);
		const badgeImages = document.createElement("span");
		badgeImages.classList.add("badges");
		for (const [badgeName, badgeVersion] of Object.entries(data.badges || {})) {
			if (cachedBadges[badgeName] && cachedBadges[badgeName][badgeVersion]) {
				const badge = cachedBadges[badgeName][badgeVersion];
				if (badge && badge.url) {
					const img = document.createElement("img");
					img.src = badge.url;
					img.alt = badge.title;
					img.title = badge.title;
					badgeImages.appendChild(img);
				}
			}
		}
		user.appendChild(badgeImages);
		const name = document.createElement("span");
		name.classList.add("name");
		name.style.color = data.color;
		name.innerText = data["display-name"];
		user.appendChild(name);
		div.appendChild(user);
		const text = document.createElement("span");
		text.classList.add("text");
		text.innerHTML = parseMessage(data.message, data.emotes);
		div.appendChild(text);
		chat.appendChild(div);
		scroll();
	};
	const disableUserMessage = (id) => {
		const message = document.querySelector(`#chat .message[data-id="${id}"]`);
		if (message) {
			message.classList.add("disabled");
		}
	};
	const disableUserMessages = (userId) => {
		const messages = document.querySelectorAll(`#chat .message[data-user-id="${userId}"]`);
		for (const message of messages) {
			message.classList.add("disabled");
		}
	};
	const disableAllMessages = () => {
		const messages = document.querySelectorAll("#chat .message");
		for (const message of messages) {
			message.classList.add("disabled");
		}
	};
	const log = (message) => {
		const chat = document.getElementById("chat");
		const div = document.createElement("div");
		div.classList.add("message", "log");
		div.innerText = message;
		chat.appendChild(div);
		scroll();
	};
	const updateChannelStatus = async () => {
		await fetch("https://api.twitch.tv/helix/streams", {
			headers: {
				"Client-ID": clientId,
				"Authorization": `Bearer ${token}`,
			},
			params: {
				user_login: channel,
			},
		})
			.then((res) => res.json())
			.then((data) => {
				const stream = data.data[0];
				const channelInfo = document.getElementById("channel-info");
				if (stream) {
					const { title, game_name, started_at, viewer_count } = stream;
					const titleElement = document.createElement("span");
					titleElement.className = "title";
					titleElement.innerText = title;
					const gameElement = document.createElement("span");
					gameElement.className = "game";
					gameElement.innerText = game_name;
					const viewersElement = document.createElement("span");
					viewersElement.className = "viewers";
					viewersElement.innerText = viewer_count;
					const startedElement = document.createElement("span");
					startedElement.className = "started";
					startedElement.title = started_at;
					startedElement.innerText = new Date(started_at).toLocaleString("pt-BR", {
						timeZone: "America/Sao_Paulo",
						timeStyle: "long",
					});
					channelInfo.innerHTML = "";
					channelInfo.appendChild(titleElement);
					channelInfo.appendChild(gameElement);
					channelInfo.appendChild(viewersElement);
					channelInfo.appendChild(startedElement);
				} else {
					channelInfo.innerHTML = "";
				}
			});
	};
	const fetchLatestMessages = async () => {
		const url = `https://recent-messages.robotty.de/api/v2/recent-messages/${channel}?hide_moderated_messages=true&limit=${limit}`;
		const messages = await fetch(url)
			.then((res) => res.json())
			.then((data) => {
				return data.messages;
			});
		const parsedMessages = [];
		const actionMessageRegex = /^\u0001ACTION ([^\u0001]+)\u0001$/;
		const unescapeHtml = (safe) =>
			safe
				.replace(/&amp;/g, "&")
				.replace(/&lt;/g, "<")
				.replace(/&gt;/g, ">")
				.replace(/&quot;/g, '"')
				.replace(/&#039;/g, "'");
		for (const message of messages) {
			const data = message.split(";").reduce((acc, cur) => {
				const [key, value] = cur.split("=");
				const intValue = parseInt(value);
				acc[key.replace("@", "")] = intValue === 1 || intValue === 0 ? Boolean(intValue) : value;
				return acc;
			}, {});
			data.badges =
				data.badges?.split(",").reduce((acc, cur) => {
					const [id, version] = cur.split("/");
					if (id && version) acc[id] = version;
					return acc;
				}, {}) || {};
			data.emotes =
				data.emotes?.split(",").reduce((acc, cur) => {
					const [id, positions] = cur.split(":");
					if (id && positions) {
						const emote = acc[id] || [];
						emote.push(positions);
						acc[id] = emote;
					}
					return acc;
				}, {}) || {};
			const [userType, username, msgType, channel, ...textMessage] =
				data["user-type"]?.split(/\s:?/) || [];
			data.message = textMessage?.join(" ");
			const actionMessage = data.message?.match(actionMessageRegex);
			if (actionMessage) {
				data.message = actionMessage[1];
				data["message-type"] = "action";
			} else {
				data["message-type"] =
					msgType === "PRIVMSG" ? "chat" : msgType === "USERNOTICE" ? data["id"] : "unknown";
			}
			data.message = unescapeHtml(data.message);
			data["user-type"] = userType;
			data.channel = channel;
			data.username = username.match(/^[\w]+/)?.join("");
			if (data.message) parsedMessages.push(data);
		}
		return parsedMessages;
	};
	if (tmi && tmi.Client) {
		let clientData = {
			channels: [channel],
			options: {
				skipMembership: true,
				skipUpdatingEmotesets: true,
				updateEmotesetsTimer: 0,
			},
			connection: {
				reconnect: true,
				secure: true,
			},
		};
		if (token && token.length) {
			clientData.identity = {
				username: channel,
				password: token,
			};
		}
		const client = new tmi.Client(clientData);
		client.connect();
		client.on("connected", (address, port) => {
			console.log(`Connected to ${address}:${port}`);
			log("Conectado!");
		});
		client.on("roomstate", async (channel, state) => {
			console.log("* Roomstate", state);
			if (firstLoad) {
				// prevent from updating on reconnect
				await Promise.allSettled([
					fetch("https://badges.twitch.tv/v1/badges/global/display").then((res) => res.json()),
					fetch(`https://badges.twitch.tv/v1/badges/channels/${state["room-id"]}/display`).then((res) =>
						res.json()
					),
				])
					.then((results) => {
						for (const result of results) {
							if (result.status === "fulfilled") {
								for (const [setID, badge] of Object.entries(result.value.badge_sets)) {
									cachedBadges[setID] = cachedBadges[setID] || {};
									for (const [badgeID, version] of Object.entries(badge.versions)) {
										cachedBadges[setID][badgeID] = {
											url: version.image_url_1x,
											title: version.title,
										};
									}
								}
							}
						}
					})
					.catch((err) => {
						console.error(err);
					});
				await Promise.allSettled([
					fetch("https://emotes.adamcy.pl/v1/global/emotes/7tv.bttv.ffz").then((res) => res.json()),
					fetch(`https://emotes.adamcy.pl/v1/channel/${state["room-id"]}/emotes/7tv.bttv.ffz`).then(
						(res) => res.json()
					),
				])
					.then((results) => {
						for (const result of results) {
							if (result.status === "fulfilled") {
								for (const emote of result.value) {
									if (!thirdPartyEmotes[emote.code]) {
										thirdPartyEmotes[emote.code] = emote.urls?.find((e) => e)?.url;
									}
								}
							}
						}
					})
					.catch((err) => {
						console.error(err);
					});
				await fetchLatestMessages()
					.then((messages) => {
						for (const data of messages) {
							addMessage(data);
						}
					})
					.catch((err) => {
						console.error(err);
					});
				firstLoad = false;
			}
		});
		client.on("message", (_, tags, message, self) => {
			if (self) return;
			const data = {
				message,
				...tags,
			};
			addMessage(data);
		});
		client.on("announcement", (_, tags, message, self, announce) => {
			if (self) return;
			const data = {
				message,
				...tags,
				announce,
			};
			addMessage(data);
		});
		client.on("clearchat", () => {
			disableAllMessages();
			log("Chat limpo!");
		});
		client.on("messagedeleted", (channel, username, deletedMessage, tags) => {
			disableUserMessage(tags["target-msg-id"]);
			log(`Mensagem de ${username} deletada!`);
			console.log(`* Message deleted: ${deletedMessage}`);
		});
		client.on("ban", (channel, username, reason, tags) => {
			disableUserMessages(tags["target-user-id"]);
			log(`Usuário ${username} banido!`);
			console.log(`* User ${username} was banned!`);
		});
		client.on("timeout", (channel, username, reason, duration, tags) => {
			disableUserMessages(tags["target-user-id"]);
			log(`Usuário ${username} limitado por ${duration} segundos!`);
			console.log(`* User ${username} was timed out for ${duration} seconds`);
		});
		client.on("disconnected", (reason) => {
			log("Desconectado!");
			console.log(`* Disconnected: ${reason}`);
		});
		client.on("reconnect", () => {
			log("Reconectando...");
			console.log("* Reconnecting...");
		});
	}
};
