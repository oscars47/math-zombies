// ------ get GitHub PAT from .env file and/or Heroku ------ //
require('dotenv').config();
const { Octokit } = require("@octokit/rest");

const octokit = new Octokit({
    auth: process.env.GITHUB_TOKEN
});

// ------- add HTTP endpoint so this file can be triggered by Google Apps Script ------- //
const express = require('express');
const axios = require('axios');
const app = express();
const port = process.env.PORT || 3000;

app.use(express.json());

app.post('/process-data', async (req, res) => {
    try {
        const { urls } = req.body; // Expecting an array of URLs

        // Validate the URLs
        if (!urls || !Array.isArray(urls) || urls.length === 0) {
            return res.status(400).send('No URLs provided or the format is incorrect');
        }

        // Process each URL
        const results = [];
        for (const url of urls) {
            const response = await axios.get(url);
            const data = response.data;
            // Add the processed data to the results array
            // You can also do any other processing as needed
            results.push(data);
        }

        // Send a response back with all the results
        res.json({ results });
    } catch (error) {
        console.error('Error:', error);
        res.status(500).send('An error occurred');
    }
});

app.listen(port, () => {
    console.log(`Server running on port ${port}`);
});



async function editFileInRepo(owner, repo, path, line, newContent, commitMessage) {
    try {
        // Step 1: Retrieve the existing file content
        const getContentResponse = await octokit.repos.getContent({
            owner: owner,
            repo: repo,
            path: path
        });

        const fileSha = getContentResponse.data.sha;
        let contentBase64 = getContentResponse.data.content;
        let content = Buffer.from(contentBase64, 'base64').toString('utf-8');

        // Step 2: Modify the content
        let contentLines = content.split('\n');
        contentLines.splice(line - 1, 0, newContent);
        content = contentLines.join('\n');
        contentBase64 = Buffer.from(content).toString('base64');

        // Step 3: Update the file in the repository
        await octokit.repos.createOrUpdateFileContents({
            owner: owner,
            repo: repo,
            path: path,
            message: commitMessage,
            content: contentBase64,
            sha: fileSha,
            committer: {
                name: 'Committer Name',
                email: 'committer-email@example.com'
            },
            author: {
                name: 'Author Name',
                email: 'author-email@example.com'
            }
        });

        console.log(`File updated successfully.`);
    } catch (error) {
        console.error('Error:', error);
    }
}

async function uploadFileToRepo(owner, repo, filePath, commitMessage) {
    try {
        const content = fs.readFileSync(filePath, 'base64');
        const fileName = path.basename(filePath);

        await octokit.repos.createOrUpdateFileContents({
            owner: owner,
            repo: repo,
            path: `path/in/your/repo/${fileName}`, // Adjust the path as needed
            message: commitMessage,
            content: content,
            committer: {
                name: 'Committer Name', // Replace with your name
                email: 'committer-email@example.com' // Replace with your email
            },
            author: {
                name: 'Author Name', // Replace with your name
                email: 'author-email@example.com' // Replace with your email
            }
        });

        console.log(`${fileName} uploaded successfully.`);
    } catch (error) {
        console.error('Error uploading file:', error);
    }
}

// Replace with your repository details and file paths
const imageFilePath = 'path/to/your/image.jpg';
const htmlFilePath = 'path/to/your/file.html';

uploadFileToRepo(repoOwner, repoName, imageFilePath, 'Add new image');
uploadFileToRepo(repoOwner, repoName, htmlFilePath, 'Add new HTML file');


// Replace with your details
const repoOwner = 'your-github-username';
const repoName = 'your-repo-name';
const filePath = 'path/to/your/file.txt';
const lineToInsertAt = 5; // Line number to insert new content
const newContent = 'Your new content here';
const commitMessage = 'Insert content at specific line';

editFileInRepo(repoOwner, repoName, filePath, lineToInsertAt, newContent, commitMessage);