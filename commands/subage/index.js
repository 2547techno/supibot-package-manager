module.exports = {
	Name: "subage",
	Aliases: ["sa"],
	Author: "supinic",
	Cooldown: 10000,
	Description: "Fetches the subscription data for a given user on a given channel on Twitch.",
	Flags: ["mention"],
	Params: null,
	Whitelist_Response: null,
	Static_Data: null,
	Code: (async function subAge (context, user, channel) {
		const userID = await sb.Utils.getTwitchID(user ?? context.user.Name);
		if (!userID) {
			return {
				success: false,
				reply: `Provided user does not exist on Twitch!`
			};
		}

		let channelID;
		if (channel) {
			channelID = await sb.Utils.getTwitchID(channel);
		}
		else {
			if (context.platform.Name !== "twitch") {
				return {
					success: false,
					reply: `When not in a Twitch channel, a specific channel name must be provided!`
				};
			}
			else if (context.privateMessage) {
				return {
					success: false,
					reply: `When in private messages, a specific channel name must be provided!`
				};
			}

			channelID = await sb.Utils.getTwitchID(context.channel.Name);
		}

		if (!channelID) {
			return {
				success: false,
				reply: `Provided channel does not exist on Twitch!`
			};
		}

		const channelName = channel ?? context.channel.Name;
		const userName = user ?? context.user.Name;

		const response = await sb.Got({
			method: "POST",
			url: "https://gql.twitch.tv/gql",
			responseType: "json",
			headers: {
				Accept: "*/*",
				"Accept-Language": "en-US",
				Authorization: `OAuth ${sb.Config.get("TWITCH_GQL_OAUTH")}`,
				"Client-ID": sb.Config.get("TWITCH_GQL_CLIENT_ID"),
				"Client-Version": sb.Config.get("TWITCH_GQL_CLIENT_VERSION"),
				"Content-Type": "text/plain;charset=UTF-8",
				Referer: `https://www.twitch.tv/popout/${channelName}/viewercard/${userName}`,
				"X-Device-ID": sb.Config.get("TWITCH_GQL_DEVICE_ID")
			},
			body: JSON.stringify([{
				operationName: "ViewerCard",
				extensions: {
					persistedQuery: {
						version: 1,
						sha256Hash: "1ad9680b56b15e64eb05cf6a99b49793a788315d32cab241968b582cc5520ed4"
					}
				},
				variables: {
					channelID,
					channelLogin: channelName,
					giftRecipientLogin: userName,
					hasChannelID: true,
					isViewerBadgeCollectionEnabled: true,
					withStandardGifting: true
				}
			}])
		});

		const [sub] = response.body;
		if (!sub) {
			return {
				success: false,
				reply: `No subscription data available!`
			};
		}

		const { relationship } = sub.data.targetUser;
		if (!relationship.cumulativeTenure) {
			return {
				success: false,
				reply: "User has hidden their subscription status."
			};
		}

		const userString = (userName === context.user.Name)
			? "You are"
			: `User ${userName} is`;

		let channelString;
		if (channelName === context.user.Name && userName === channelName) {
			channelString = "yourself";
		}
		else if (channelName === context.user.Name) {
			channelString = "you";
		}
		else {
			channelString = channelName;
		}

		const { daysRemaining, months } = relationship.cumulativeTenure;
		if (!relationship.subscriptionBenefit) {
			if (daysRemaining === 0 && months === 0) {
				return {
					reply: `${userString} not subscribed to ${channelString}, and never has been.`
				};
			}
			else {
				return {
					reply: `${userString} not subscribed to ${channelString}, but used to be subscribed for ${months} months in total.`
				};
			}
		}
		else {
			const benefit = relationship.subscriptionBenefit;
			const giftString = (benefit.gift.isGift) ? "gifted" : "";
			const primeString = (benefit.purchasedWithPrime) ? "Prime" : "";
			const tier = benefit.tier.replace("000", "");

			return {
				reply: sb.Utils.tag.trim `
					${userString} subscribed to ${channelString}
					for ${months} months in total
					with a Tier ${tier} ${giftString} ${primeString} subscription.
					Sub will renew/expire in ${daysRemaining} days.
				`
			};
		}
	}),
	Dynamic_Description: null
};