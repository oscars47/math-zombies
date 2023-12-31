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
    // Initialize simple-git
    console.log('Initializing git at '+ Date.now() + '...');
    const git = simpleGit({
        baseDir: process.cwd(),
        binary: 'git',
        config: []
    });
    
    const token = process.env.GITHUB_TOKEN; 
    const repo = 'https://github.com/oscars47/math-zombies.git';
    
    // Form the remote URL with the token
    const remoteWithToken = `https://${token}:x-oauth-basic@${repo.replace('https://', '')}`;
    
    try {
        // Check if the 'origin' remote already exists
        const remotes = await git.getRemotes(true);
        const originExists = remotes.some(remote => remote.name === 'origin');
    
        if (originExists) {
            // Update the existing 'origin' remote
            await git.remote(['set-url', 'origin', remoteWithToken]);
        } else {
            // Add 'origin' remote if it doesn't exist
            await git.addRemote('origin', remoteWithToken);
        }
    
    } catch (error) {
        console.error('Error:', error);
    }    

    const htmlFileName = '../post_files/'+htmlName
    const miniHtmlFileName = '../post_files/'+miniHtmlName
    const imageFileName = '../images/'+imageName

  try {
    console.log('Downloading files...');
    await downloadFile(htmlUrl, htmlFileName);
    await downloadFile(miniHtmlUrl, miniHtmlFileName);
    await downloadFile(imageUrl, imageFileName);

    // pull from master
    console.log('Pulling from master...');
    await git.pull('origin', 'main');

    console.log('Creating a new branch...');
    const newBranch = 'new-branch-'+Date.now();
    await git.checkoutLocalBranch(newBranch);

    console.log('Adding files to the branch...');
    await git.add([htmlFileName, imageFileName]);

    console.log('Inserting miniHTML into target HTML file...');
    const miniHtml = await fsPromises.readFile(miniHtmlFileName, 'utf8');
    console.log('mini file:' + miniHtml)
    
    function insertMiniHtml(targetHtmlPath, miniHtmlPath) {
        return fs.readFile(targetHtmlPath, 'utf8')
          .then(targetHtml => {
            return fs.readFile(miniHtmlPath, 'utf8')
              .then(miniHtml => {
                // Check if the marker exists in the target HTML
                if (!targetHtml.includes('<!-- ADD NEW POSTS HERE -->')) {
                  throw new Error('Marker not found in target HTML');
                }
      
                // Replace the marker with marker + miniHtml
                const updatedHtml = targetHtml.replace(
                  '<!-- ADD NEW POSTS HERE -->',
                  `<!-- ADD NEW POSTS HERE -->\n${miniHtml}`
                );
      
                // Write the updated HTML back to the file
                fs.writeFile(targetHtmlPath, updatedHtml);
              });
          })
          .catch(error => {
            console.error('An error occurred:', error);
          });
      }

    console.log('Writing updated HTML file...');
    insertMiniHtml('../posts.html', miniHtmlFileName);    
    
    await git.add('../posts.html');

    console.log('Committing changes...');
    await git.commit('Add new post: '+htmlName+'. Summary:'+summary);

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
        data = data.toString().trim();

        // find first occurence of { to start parsing
        let start = data.indexOf('{');
        let end = data.indexOf('}');
        data = data.substring(start, end+1);

        console.log('Received data from client:', data);
    
        // Assuming data is a JSON string with the necessary information
        const { htmlUrl, miniHtmlUrl, imageUrl, htmlName, miniHtmlName, imageName, summary } = JSON.parse(data);
        
        // Call the main function with the received data
        await main(htmlUrl, miniHtmlUrl, imageUrl, htmlName, miniHtmlName, imageName, summary);
  
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
    console.log('+---------------+')
    console.log('+ version 0.0.7 +')
    console.log('+---------------+')
  });