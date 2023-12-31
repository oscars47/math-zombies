const net = require('net');
const axios = require('axios');
const fs = require('fs'); // Import standard fs for createWriteStream
const fsPromises = fs.promises; // Continue using fs.promises for other async operations
const simpleGit = require('simple-git');

// Function to download a file
async function downloadFile(url, path) {
    const writer = fs.createWriteStream(path);
  
    const response = await axios({
      url,
      method: 'GET',
      responseType: 'stream'
    });
  
    response.data.pipe(writer);
  
    return new Promise((resolve, reject) => {
      writer.on('finish', resolve);
      writer.on('error', reject);
    });
  }

// Main function
async function main(htmlUrl, miniHtmlUrl, imageUrl, htmlName, miniHtmlName, imageName, summary) {

    console.log('version 0.0.3.....')
    const git = simpleGit();
    process.env.GIT_ASKPASS = 'echo';
    process.env.GIT_USERNAME = 'oscars47';
    process.env.GIT_PASSWORD = process.env.GITHUB_TOKEN; // Token stored in an environment variable

    const htmlFileName = '../post_files/'+htmlName
    const miniHtmlFileName = '../post_files/'+miniHtmlName
    const imageFileName = '../images/'+imageName

  try {
    console.log('Downloading files...');
    await downloadFile(htmlUrl, htmlFileName);
    await downloadFile(miniHtmlUrl, miniHtmlFileName);
    await downloadFile(imageUrl, imageFileName);

    console.log('Creating a new branch...');
    const newBranch = 'new-branch-'+htmlName.replace('.html', '')+'-'+Date.now();
    await git.checkoutLocalBranch(newBranch);

    console.log('Adding files to the branch...');
    await git.add([htmlFileName, imageFileName]);

    console.log('Inserting miniHTML into target HTML file...');
    const targetHtml = await fsPromises.readFile('../posts.html', 'utf8');
    const miniHtml = await fsPromises.readFile(miniHtmlFileName, 'utf8');
    const updatedHtml = targetHtml.replace('<!-- ADD NEW POSTS HERE -->', '<!-- ADD NEW POSTS HERE -->\n' + miniHtml);
    await fsPromises.writeFile('../posts.html', updatedHtml);
    await git.add('../posts.html');

    console.log('Committing changes...');
    await git.commit('Add new post: '+htmlName+' - '+summary);

    console.log('Deleting miniHTML file...');
    await fsPromises.unlink(miniHtmlFileName);

    console.log('Pushing changes to GitHub...');
    await git.push('origin', newBranch);

    console.log('Task completed successfully.');
  } catch (error) {
    console.error('An error occurred:', error);
  }
}

// TCP Server Setup
const server = net.createServer((socket) => {
    console.log('Client connected');
  
    socket.on('data', async (data) => {
      try {
        console.log('Received data:', data.toString());
  
        // Assuming data is a JSON string with the necessary information
        const { htmlUrl, miniHtmlUrl, imageUrl, htmlName, miniHtmlName, imageName } = JSON.parse(data.toString());
        
        // Call the main function with the received data
        await main(htmlUrl, miniHtmlUrl, imageUrl, htmlName, miniHtmlName, imageName);
  
      } catch (error) {
        console.error('Error processing data:', error);
      }
    });
  
    socket.on('end', () => {
      console.log('Client disconnected');
    });
  });
  
  server.listen(8080, () => {
    console.log('Server listening on port 8080');
  });