window.onload = async function () {
	const limit = 100;
	const channel = localStorage.getItem("twitch-channel") || "xogum";
	const channelId = localStorage.getItem("twitch-channel-id");
	const clientId = localStorage.getItem("twitch-client-id");
	const token = localStorage.getItem("twitch-token");
	const thirdPartyEmotes = {};
	await Promise.allSettled([
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
	const fetchBadges = async (id = "global") => {
		let url;
		if (id.toLowerCase() === "global") {
			url = "https://badges.twitch.tv/v1/badges/global/display";
		} else if (!isNaN(id)) {
			url = `https://badges.twitch.tv/v1/badges/channels/${id}/display`;
		} else {
			return;
		}
		await fetch(url)
			.then((res) => res.json())
			.then((data) => {
				for (const [setID, badge] of Object.entries(data.badge_sets)) {
					badges[setID] = badges[setID] || {};
					for (const [badgeID, version] of Object.entries(badge.versions)) {
						badges[setID][badgeID] = {
							url: version.image_url_1x,
							title: version.title,
						};
					}
				}
			})
			.catch((err) => {
				console.error(err);
			});
	};
	await fetchBadges(); // global badges
	console.log("badges", badges);
	if (token && !!token.length && channelId && !!channelId.length) {
		const headers = new Headers();
		headers.append("Authorization", `Bearer ${token}`);
		headers.append("Client-Id", clientId);
		await Promise.allSettled([
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
	const appendMessage = (message) => {
		const chat = document.getElementById("chat");
		const div = document.createElement("div");
		div.id = message.id;
		div.className = "message";
		const messages = chat.querySelectorAll(".message");
		const hasMention = message.text
			.split(" ")
			.some((word) => word === new RegExp(`^@?${channel}$`, "i"));
		const lastMessage = messages[messages.length - 1];
		if (hasMention) {
			div.className += " mention";
		} else if (lastMessage) {
			const lastMessageClass = lastMessage.className;
			if (lastMessageClass.includes("odd")) {
				div.className += " even";
			} else {
				div.className += " odd";
			}
		} else {
			div.className += " odd";
		}
		div.className += ` ${message.type} ${message.first ? "first" : ""}`;
		if (message.reply) {
			div.title = `${message.reply.user}: ${message.reply.text}`;
			div.addEventListener("click", () => {
				Array.from(div.querySelectorAll(".message"))
					.find((m) => m.id.includes(message.reply.id))
					.scrollIntoView();
			});
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
		// badges
		const badgeImages = document.createElement("span");
		badgeImages.className = "badges";
		for (const [badgeName, badgeVersion] of Object.entries(message.badges || {})) {
			if (badges[badgeName] && badges[badgeName][badgeVersion]) {
				const badge = badges[badgeName][badgeVersion];
				if (badge) {
					const img = document.createElement("img");
					img.src = badge.url;
					img.alt = badge.title;
					img.title = badge.title;
					badgeImages.appendChild(img);
				}
			}
		}
		user.appendChild(badgeImages);
		// name
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
	const log = (message) => {
		const chat = document.getElementById("chat");
		const div = document.createElement("div");
		div.className = "message log";
		div.innerText = message;
		chat.appendChild(div);
		scroll();
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
			log(`Seja bem-vindo!`);
			console.log(`* Connected to ${address}:${port} as ${client.getUsername()}`);
		});
		client.on("roomstate", (channel, state) => {
			console.log("* Roomstate", state);
			console.log(client.globaluserstate);
			console.log(client.userstate);
		});
		client.on("message", (_, tags, message, self) => {
			console.log(tags);
			if (self) return;
			const data = {
				id: `${tags["user-id"]}:${tags.id}:${tags["tmi-sent-ts"]}`,
				type: tags["message-type"],
				text: parseMessage(message, tags.emotes),
				name: tags["display-name"],
				color: tags.color || "#eee",
				badges: tags.badges ?? {},
				highlight: tags.id === "highlighted-message",
				timestamp: tags["tmi-sent-ts"],
				reply: tags.hasOwnProperty("reply-parent-msg-id")
					? {
							id: tags["reply-parent-msg-id"],
							user: tags["reply-parent-display-name"],
							text: tags["reply-parent-msg-body"],
					  }
					: null,
				first: tags.hasOwnProperty("first-msg") ? tags["first-msg"] : null,
			};
			addMessage(data);
		});
		client.on("announcement", console.log);
		client.on("clearchat", () => {
			const messages = document.getElementsByClassName("message");
			for (const message of messages) {
				message.style.opacity = 0.15;
			}
			log("Chat limpo!");
		});
		client.on("messagedeleted", (channel, username, deletedMessage, tags) => {
			const id = tags["target-msg-id"];
			const message = Array.from(document.querySelectorAll(".message")).find((m) => m.id.includes(id));
			if (message) {
				message.style.opacity = 0.15;
			}
			log(`Mensagem de ${username} deletada!`);
		});
		client.on("ban", (channel, username, reason, tags) => {
			const id = tags["target-user-id"];
			const messages = Array.from(document.querySelectorAll(".message")).filter((m) =>
				m.id.includes(id)
			);
			for (const message of messages) {
				message.style.opacity = 0.15;
			}
			log(`Usuário ${username} banido!`);
		});
		client.on("timeout", (channel, username, reason, duration, tags) => {
			const id = tags["target-user-id"];
			const messages = Array.from(document.querySelectorAll(".message")).filter((m) =>
				m.id.includes(id)
			);
			for (const message of messages) {
				message.style.opacity = 0.15;
			}
			log(`Usuário ${username} limitado por ${duration} segundos!`);
		});
		client.on("disconnected", (reason) => {
			console.log(`* Disconnected: ${reason}`);
			log("Desconectado!");
		});
	}
};
