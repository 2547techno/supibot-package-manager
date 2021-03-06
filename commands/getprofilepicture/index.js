module.exports = {
	Name: "profilepicture",
	Aliases: ["pfp"],
	Author: "supinic",
	Cooldown: 10000,
	Description: "For a given Twitch user, this command will fetch their profile picture.",
	Flags: ["mention","non-nullable","pipe"],
	Params: null,
	Whitelist_Response: null,
	Static_Data: null,
	Code: (async function profilePicture (context, username) {
		const { body } = await sb.Got("Helix", {
			url: "users",
			searchParams: {
				login: (username ?? context.user.Name)
			},
			throwHttpErrors: false
		});

		if (body.data.length === 0) {
			return {
				success: false,
				reply: `No such user found on Twitch!`
			};
		}

		const [user] = body.data;
		return {
			reply: `Profile picture for ${user.display_name}: ${user.profile_image_url}`
		};
	}),
	Dynamic_Description: null
};