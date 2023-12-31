// ------ get GitHub PAT from .env file and/or Heroku ------ //
require('dotenv').config();
const { Octokit } = require("@octokit/rest");

const octokit = new Octokit({
    auth: process.env.GITHUB_TOKEN
});

const { exec } = require('child_process');

// ------- get the latest commit SHA ------- //
async function gitPull() {
    return new Promise((resolve, reject) => {
        exec('git pull', (error, stdout, stderr) => {
            if (error) {
                console.error(`exec error: ${error}`);
                return reject(error);
            }
            console.log(`stdout: ${stdout}`);
            console.error(`stderr: ${stderr}`);
            resolve(stdout);
        });
    });
}

// ------- create a new branch ------- //
async function createBranch(owner, repo, newBranchName, mainBranchName = 'main') {
    try {
        // Get the SHA of the latest commit on the main branch
        const branch = await octokit.repos.getBranch({
            owner,
            repo,
            branch: mainBranchName,
        });
        const sha = branch.data.commit.sha;

        // Create a new branch from the main branch SHA
        await octokit.git.createRef({
            owner,
            repo,
            ref: `refs/heads/${newBranchName}`,
            sha,
        });

        console.log(`Branch created: ${newBranchName}`);
    } catch (error) {
        console.error('Error creating new branch:', error);
    }
}

const newBranchName = 'test';
const user = 'oscars47';
const repo = 'math-zombies';
const email = 'orsa2020@mymail.pomona.edu';

// ------- add HTTP endpoint so this file can be triggered by Google Apps Script ------- //
const express = require('express');
const axios = require('axios');
const fs = require('fs').promises;
const path = require('path');
const app = express();
const port = process.env.PORT || 80;

const targetFilePath = path.join(__dirname, '../posts.html');


app.use(express.json());
app.post('/process-data', async (req, res) => {
    try {
        const { htmlUrl, miniHtmlUrl, imageUrl, htmlName, miniHtmlName, imageName } = req.body;

        // Validate the URLs
        if (!htmlUrl || !miniHtmlUrl || !imageUrl) {
            return res.status(400).send('Missing one or more URLs');
        }

        // Define a function to download a file
        async function downloadFile(fileUrl, outputLocationPath) {
            const writer = fs.createWriteStream(outputLocationPath);
            const response = await axios({
                method: 'get',
                url: fileUrl,
                responseType: 'stream',
            });

            response.data.pipe(writer);

            return new Promise((resolve, reject) => {
                writer.on('finish', resolve);
                writer.on('error', reject);
            });
        }

        // set paths for each file
        const htmlPath = path.join(__dirname, '../post_files/'+htmlName);
        const miniHtmlPath = path.join(__dirname, '../mini_files'+miniHtmlName);
        const imagePath = path.join(__dirname, '../images'+imageName);

        // Download each file
        await downloadFile(htmlUrl, htmlPath);
        await downloadFile(miniHtmlUrl, miniHtmlPath);
        await downloadFile(imageUrl, imagePath);

        console.log(`File downloaded successfully.`);
        res.send('Files downloaded successfully');
    } catch (error) {
        console.error('Error:', error);
        res.status(500).send('An error occurred');
    }
});

app.listen(port, () => {
    console.log(`Server running on port ${port}`);
});

// for extracting the html content from the mini file //

async function updateGitHubFileWithHtmlContent(miniHtmlPath, owner, repo, targetFilePath, insertLine, commitMessage, newBranchName) {
    async function processAndDeleteFile(filePath) {
        try {
            const content = await fs.readFile(filePath, 'utf8');
    
            // Now delete the file
            await fs.unlink(filePath);
    
            console.log(`File deleted successfully: ${filePath}`);
            return content; // Return the content if needed
        } catch (error) {
            console.error('Error:', error);
            throw error; // Rethrow the error for further handling if necessary
        }
    }
    try {
        // Extract content from the downloaded HTML file
        // first, process and delete mini file
        const miniHtmlContent = await processAndDeleteFile(miniHtmlPath);
        console.log(`got mini html content: ${miniHtmlContent}`);

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
                    branch: newBranchName,
                    message: commitMessage,
                    content: contentBase64,
                    sha: fileSha,
                    committer: {
                        name: user,
                        email: email
                    },
                    author: {
                        name: user,
                        email: email
                    }
                });
        
                console.log(`mini description updated successfully.`);
            } catch (error) {
                console.error('Error:', error);
            }
        }

        // Edit the file in the GitHub repository
        await editFileInRepo(owner, repo, targetFilePath, insertLine, newContent, commitMessage);
    } catch (error) {
        console.error('Error:', error);
    }
}

// file to upload the image and main file to repo //
async function uploadFileToRepo(owner, repo, filePath, commitMessage, newBranchName) {
    try {
        const content = fs.readFileSync(filePath, 'base64');
        const fileName = path.basename(filePath);

        await octokit.repos.createOrUpdateFileContents({
            owner: owner,
            repo: repo,
            branch: newBranchName,
            path: filePath, // assumes file path is the same as downloaded
            message: commitMessage,
            content: content,
            committer: {
                name: user, // Replace with your name
                email: email // Replace with your email
            },
            author: {
                name: user, // Replace with your name
                email: email // Replace with your email
            }
        });

        console.log(`${fileName} uploaded successfully.`);
    } catch (error) {
        console.error('Error uploading file:', error);
    }
}

// ---------- perform all functions ---------- //
async function main() {

    console.log('starting script...')

    await gitPull();
    console.log('pulled from git')

    await createBranch(user, repo, newBranchName);
    console.log('created branch')

    // now insert the html content into the main file
    await updateGitHubFileWithHtmlContent(miniHtmlPath, user, repo, targetFilePath, 122, 'added mini descrip for '+htmlName, newBranchName);


    // add image and html file to repo
    await uploadFileToRepo('oscars47', 'math-zombies', htmlPath, 'added '+htmlName);
    await uploadFileToRepo('oscars47', 'math-zombies', imagePath, 'added '+imageName);

}