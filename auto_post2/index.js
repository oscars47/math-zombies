const net = require('net');
const axios = require('axios');
const fs = require('fs'); // Import standard fs for createWriteStream
const fsp = fs.promises; // Continue using fs.promises for other async operations
const simpleGit = require('simple-git');
const { exec } = require('child_process');

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

function execShellCommand(cmd) {
    return new Promise((resolve, reject) => {
      exec(cmd, (error, stdout, stderr) => {
        if (error) {
          console.warn(error);
          reject(error);
        }
        resolve(stdout ? stdout : stderr);
      });
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

    const htmlFileName = '../post_files/'+htmlName+'.html'
    const miniHtmlFileName = '../post_files/'+miniHtmlName
    const imageFileName = '../images/'+imageName

  try {

    try{
        console.log('Syncing to main...');
        await execShellCommand('git fetch origin');
        await execShellCommand('git reset --hard origin/main');
        await execShellCommand('git checkout .');
    }
    catch (error) {
        console.log('Error syncing to main');
    }

    // Download the files
    console.log('Downloading files...');
    await downloadFile(htmlUrl, htmlFileName);
    await downloadFile(miniHtmlUrl, miniHtmlFileName);
    await downloadFile(imageUrl, imageFileName);

    // now pull from main
    console.log('Pulling from main...');
    try {
        await git.pull('origin', 'main');
    }
    catch (error) {
        console.log('Fetching from origin...');
        await execShellCommand('git fetch origin');
        console.log('Resetting to origin/main...');
        await execShellCommand('git reset --hard origin/main');
        console.log('Checking out...');
        await execShellCommand('git checkout .');
        console.log('Git commands executed successfully');
        await git.pull('origin', 'main');
    }

    console.log('HTML file downloaded to '+htmlFileName);
    console.log('miniHTML file downloaded to '+miniHtmlFileName);
    console.log('Image file downloaded to '+imageFileName);

    // Create a new branch
    console.log('Creating a new branch...');
    const newBranch = 'new-branch-'+Date.now();
    await git.checkoutLocalBranch(newBranch);

    console.log('Adding files to the branch...');
    await git.add([htmlFileName, imageFileName]);

    console.log('Inserting miniHTML into target HTML file...');
    // console.log('Mini html:');
    // console.log(await fsp.readFile(miniHtmlFileName, 'utf8'));

    // console.log('Target html before insertion:');
    // console.log(await fsp.readFile('../posts.html', 'utf8'));
    
    function insertMiniHtml(targetHtmlPath, miniHtmlPath) {
        return fsp.readFile(targetHtmlPath, 'utf8')
            .then(targetHtml => {
                return fsp.readFile(miniHtmlPath, 'utf8')
                    .then(miniHtml => {
                        if (!targetHtml.includes('<!-- ADD NEW POSTS HERE -->')) {
                            throw new Error('Marker not found in target HTML');
                        }
    
                        const updatedHtml = targetHtml.replace(
                            '<!-- ADD NEW POSTS HERE -->',
                            `<!-- ADD NEW POSTS HERE -->\n${miniHtml}`
                        );
    
                        // Return the writeFile promise to ensure it completes before continuing
                        return fsp.writeFile(targetHtmlPath, updatedHtml);
                    });
            })
            .catch(error => {
                console.error('An error occurred:', error);
            });
    }
    
    console.log('Writing updated HTML file...');
    await insertMiniHtml('../posts.html', miniHtmlFileName); // need to wait to ensure the file is written before continuing    

    // console.log('Target html after insertion:');
    // console.log(await fsp.readFile('../posts.html', 'utf8'));
    
    await git.add('../posts.html');

    console.log('Committing changes...');
    await git.commit('Add new post: '+htmlName+'. Summary:'+summary);

    console.log('Deleting miniHTML file...');
    await fsp.unlink(miniHtmlFileName);

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