const axios = require('axios');
const fs = require('fs').promises;
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
    await downloadFile(htmlUrl, htmlName);
    await downloadFile(miniHtmlUrl, miniHtmlName);
    await downloadFile(imageUrl, imageName);

    console.log('Creating a new branch...');
    await git.checkoutLocalBranch('new-branch');

    console.log('Adding files to the branch...');
    await git.add([htmlName, imageName]);

    console.log('Committing changes...');
    await git.commit('Add new files');

    console.log('Inserting miniHTML into target HTML file...');
    const targetHtml = await fs.readFile('target.html', 'utf8');
    const miniHtml = await fs.readFile(miniHtmlName, 'utf8');
    const updatedHtml = targetHtml.replace('<!-- ADD NEW POSTS HERE -->', '<!-- ADD NEW POSTS HERE -->\n' + miniHtml);
    await fs.writeFile('target.html', updatedHtml);

    console.log('Deleting miniHTML file...');
    await fs.unlink(miniHtmlName);

    console.log('Pushing changes to GitHub...');
    await git.push('origin', 'new-branch');

    console.log('Task completed successfully.');
  } catch (error) {
    console.error('An error occurred:', error);
  }
}

// Example usage
main('htmlFileUrl', 'miniHtmlFileUrl', 'imageUrl', 'htmlName.html', 'miniHtmlName.html', 'imageName.png');