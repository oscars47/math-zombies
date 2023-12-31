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
async function main(htmlUrl, miniHtmlUrl, imageUrl, htmlName, miniHtmlName, imageName) {
  const git = simpleGit();

  try {
    console.log('Downloading files...');
    await downloadFile(htmlUrl, '../post_files/'+htmlName);
    await downloadFile(miniHtmlUrl, '../post_files/'+miniHtmlName);
    await downloadFile(imageUrl, '../images/'+imageName);

    console.log('Creating a new branch...');
    await git.checkoutLocalBranch('new-branch');

    console.log('Adding files to the branch...');
    await git.add([htmlName, imageName]);

    console.log('Committing changes...');
    await git.commit('Add new files');

    console.log('Inserting miniHTML into target HTML file...');
    const targetHtml = await fsPromises.readFile('../posts.html', 'utf8');
    const miniHtml = await fsPromises.readFile(miniHtmlName, 'utf8');
    const updatedHtml = targetHtml.replace('<!-- ADD NEW POSTS HERE -->', '<!-- ADD NEW POSTS HERE -->\n' + miniHtml);
    await fsPromises.writeFile('../posts.html', updatedHtml);

    console.log('Deleting miniHTML file...');
    await fsPromises.unlink(miniHtmlName);

    console.log('Pushing changes to GitHub...');
    await git.push('origin', 'new-branch');

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