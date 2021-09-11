module.exports = {
	Name: "artflow-gatherer",
	Expression: "0 */5 * * * *",
	Description: "Collects image data from artflow.ai",
	Defer: (() => ({
		start: 0,
		end: 30000
	})),
	Type: "Bot",
	Code: (async function artflowGatherer () {
		const get = sb.Got.extend({
			method: "POST",
			prefixUrl: "https://artflow.ai",
			responseType: "json",
			timeout: 60_000,
			retry: 0,
			throwHttpErrors: false
		});

		const [editorData, communityData] = await Promise.all([
			get("show_editor_choice"),
			get("show_community_work")
		]);

		const data = [];
		if (editorData.statusCode === 200) {
			data.push(...editorData.body);
		}
		if (communityData.statusCode === 200) {
			data.push(...communityData.body);
		}
		if (data.length === 0) {
			return;
		}

		for (const item of data) {
			const row = await sb.Query.getRow("data", "Artflow_Image");
			await row.load(item.filename, true);
			if (row.loaded) { // Image already exists in the database
				continue;
			}

			let fileIndex;
			const indexResponse = await sb.Got({
				method: "HEAD",
				url: `https://artflowbucket.s3.amazonaws.com/generated/${item.index}.webp`,
				throwHttpErrors: false
			});

			if (indexResponse.statusCode === 200) {
				fileIndex = item.index;
			}
			else {
				const filenameResponse = await sb.Got({
					method: "HEAD",
					url: `https://artflowbucket.s3.amazonaws.com/generated/${item.filename}.webp`,
					throwHttpErrors: false
				});

				if (filenameResponse.statusCode === 200) {
					fileIndex = item.filename;
				}
			}

			if (!fileIndex) { // File does not exist anymore
				continue;
			}

			const formData = new sb.Got.FormData();
			formData.append("reqtype", "urlupload");
			formData.append("url", `https://artflowbucket.s3.amazonaws.com/generated/${fileIndex}.webp`);

			const uploadResponse = await sb.Got({
				url: "https://catbox.moe/user/api.php",
				method: "POST",
				throwHttpErrors: false,
				headers: {
					...formData.getHeaders()
				},
				body: formData.getBuffer(),
				retry: 0,
				timeout: 10000
			});

			if (uploadResponse.statusCode !== 200) { // Upload failed
				continue;
			}

			row.setValues({
				Filename: item.filename,
				ID: item.index,
				Prompt: item.text_prompt ?? null,
				Upload_Link: uploadResponse.body
			});

			await row.save({
				ignore: true,
				skipLoad: true
			});
		}
	})
};
