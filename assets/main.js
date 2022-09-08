window.onload = function () {
	const limit = 100;
	const channel = localStorage.getItem("twitch-channel") || "xogum";
	const channelId = localStorage.getItem("twitch-channel-id");
	const clientId = localStorage.getItem("twitch-client-id");
	const token = localStorage.getItem("twitch-token");
	const thirdPartyEmotes = {};
	Promise.allSettled([
		fetch("https://emotes.adamcy.pl/v1/global/emotes/7tv.bttv.ffz").then((res) => res.json()),
		fetch("https://emotes.adamcy.pl/v1/channel/xogum/emotes/7tv.bttv.ffz").then((res) => res.json()),
	]).then((results) => {
		for (const result of results) {
			if (result.status === "fulfilled") {
				for (const emote of result.value) {
					if (!thirdPartyEmotes[emote.code]) {
						thirdPartyEmotes[emote.code] = emote.urls?.find((e) => e)?.url;
					}
				}
			}
		}
	});
	const badges = {};
	if (token && !!token.length && channelId && !!channelId.length) {
		const headers = new Headers();
		headers.append("Authorization", `Bearer ${token}`);
		headers.append("Client-Id", clientId);
		Promise.allSettled([
			fetch("https://api.twitch.tv/helix/chat/badges/global", { headers })
				.then((res) => res.json())
				.catch(console.error),
			fetch("https://api.twitch.tv/helix/chat/badges?broadcaster_id=" + channelId, { headers })
				.then((res) => res.json())
				.catch(console.error),
		]).then((results) => {
			for (const result of results) {
				if (result.status === "fulfilled") {
					for (const badge of result.value.data) {
						badges[badge.set_id] = badges[badge.set_id] || {};
						for (const version of badge.versions) {
							badges[badge.set_id][version.id] = version.image_url_1x;
						}
					}
				}
			}
		});
	}
	const scroll = () => {
		document.scrollingElement.scrollTop = document.scrollingElement.scrollHeight;
	};
	const htmlEscape = (str) =>
		str.replace(
			/[&<>"']/g,
			(tag) =>
				({
					"&": "&amp;",
					"<": "&lt;",
					">": "&gt;",
					'"': "&quot;",
					"'": "&#39;",
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
		console.log(regex);
		while ((match = regex.exec(str)) !== null) {
			console.log(match);
			const before = /\s|undefined/.test(str[match.index - 1]);
			const after = /\s|undefined/.test(str[match.index + findLen]);
			if (before && after) {
				indices.push(match.index);
			}
		}
		return indices;
	};
	const replaceLinks = (text) => {
		try {
			const regex = /^(?:https?:\/\/)?[a-z0-9-]+\.\/?[^\s]+/i;
			const sep = " ";
			return text
				.split(sep)
				.map((word) => {
					if (regex.test(word)) {
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
			const regex = /\@[a-z0-9_]{4,25}/i;
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
	const getCachedMessages = () => {
		const cachedMessages = JSON.parse(sessionStorage.getItem("chatMessages"));
		if (cachedMessages) {
			return cachedMessages;
		}
		return [];
	};
	const findCachedMessage = (id) => {
		const cachedMessages = getCachedMessages();
		return cachedMessages.find((m) => m.id === id);
	};
	const cacheMessage = (message) => {
		const cachedMessages = getCachedMessages();
		if (findCachedMessage(message.id)) return;
		cachedMessages.push(message);
		sessionStorage.setItem("chatMessages", JSON.stringify(cachedMessages));
	};
	const removeCachedMessage = (id) => {
		const cachedMessages = getCachedMessages();
		const index = cachedMessages.findIndex((m) => m.id === id);
		if (index !== -1) {
			cachedMessages.splice(index, 1);
			sessionStorage.setItem("chatMessages", JSON.stringify(cachedMessages));
		}
	};
	const parseEmotes = (text, emotes) => {
		text = text.split("");
		try {
			emotes.map(([url, indices]) => {
				console.log("indices", indices);
				console.log("url", url);
				indices.map((i) => {
					const [start, end] = i.split("-").map((n) => parseInt(n));
					const emoteText = text.slice(start, end + 1).join("");
					const emoteTextEscaped = regexEscape(emoteText);
					const emoteImg = `<img class="emote" src="${url}" alt="${emoteTextEscaped}" title="${emoteTextEscaped}">`;
					const arrayLength = end - start;
					console.log(arrayLength, start, end);
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
	const appendMessage = (message) => {
		const hasMention = new RegExp(`\\b@?${channel}\\b`, "gi").test(message.text);
		const chat = document.getElementById("chat");
		const div = document.createElement("div");
		div.id = message.id;
		div.className = "message";
		div.classList.add(message.name);
		if (hasMention) {
			div.classList.add("mention");
		}
		// meta
		const user = document.createElement("span");
		user.className = "user";
		// timestamp to time
		const timestamp = document.createElement("span");
		timestamp.className = "timestamp";
		timestamp.innerText = timestampToTime(message.timestamp);
		timestamp.title = timestampToDate(message.timestamp);
		user.appendChild(timestamp);
		// user badges
		const badges = document.createElement("span");
		badges.className = "badges";
		for (const badge of message.badges) {
			const [name, version] = Object.entries(badge);
			if (badges[name] && badges[name][version]) {
				const img = document.createElement("img");
				img.src = badges[name][version];
				badges.appendChild(img);
			}
		}
		user.appendChild(badges);
		// user name
		const name = document.createElement("span");
		name.className = "name";
		name.style.color = message.color;
		name.innerText = message.name;
		user.appendChild(name);
		div.appendChild(user);
		// message
		const text = document.createElement("span");
		text.className = "text";
		text.innerHTML = message.text;
		div.appendChild(text);
		chat.appendChild(div);
		scroll();
	};
	const removeMessage = (id) => {
		removeCachedMessage(id);
		const message = document.getElementById(id);
		if (message) {
			message.remove();
		}
	};
	const addMessage = (message) => {
		cacheMessage(message);
		appendMessage(message);
		const messages = document.getElementsByClassName("message");
		if (messages.length > limit) {
			removeMessage(messages[0].id);
		}
	};
	const cachedMessages = getCachedMessages();
	if (cachedMessages) {
		for (const message of cachedMessages) {
			appendMessage(message);
		}
	}
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
			console.log(`* Connected to ${address}:${port} as ${client.getUsername()}`);
		});
		client.on("message", (_, tags, message, self) => {
			console.log(tags);
			if (self) return;
			const data = {
				id: `${tags["user-id"]}-${tags["msg-id"]}-${tags["tmi-sent-ts"]}`,
				text: parseMessage(message, tags.emotes),
				name: tags["display-name"],
				color: tags.color || "#eee",
				badges: tags.badges ? Object.values(tags.badges) : [],
				highlight: tags["msg-id"] === "highlighted-message",
				timestamp: tags["tmi-sent-ts"],
			};
			addMessage(data);
		});
		client.on("clearchat", () => {
			const messages = document.getElementsByClassName("message");
			for (const message of messages) {
				message.style.opacity = 0.5;
			}
		});
		client.on("messagedeleted", (channel, username, deletedMessage, tags) => {
			const id = tags["target-msg-id"];
			const message = document.querySelectorAll(".message").find((m) => m.id.includes(id));
			if (message) {
				message.style.opacity = 0.5;
			}
		});
		client.on("ban", (channel, username, reason, tags) => {
			const id = tags["target-user-id"];
			const messages = document.querySelectorAll(".message").filter((m) => m.id.includes(id));
			for (const message of messages) {
				message.style.opacity = 0.5;
			}
		});
		client.on("timeout", (channel, username, reason, duration, tags) => {
			const id = tags["target-user-id"];
			const messages = document.querySelectorAll(".message").filter((m) => m.id.includes(id));
			for (const message of messages) {
				message.style.opacity = 0.5;
			}
		});
		client.on("disconnected", (reason) => {
			console.log(`* Disconnected: ${reason}`);
		});
	}
};
