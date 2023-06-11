const express = require('express');
const axios = require('axios');
const cors = require('cors');
const fs = require('fs');
const sharp = require('sharp');
const base64 = require('base64-js');


const app = express();
const port = 3001; // You can change the port number if needed

// Define your API routes here

app.use(express.json()); // Middleware to parse JSON request bodies
app.use(cors()); // TO ESCAPE CORS POLICY

function convertDateToTimestamp(dateString) {
  const timestamp = Date.parse(dateString);
  return timestamp;
}

// Proxy route to call the final endpoint
app.post('/api', async (req, res) => {
  try {
    const { body } = req;

    const headers = {
      'Content-Type': 'application/json',
      'Authorization': 'Bearer API_KEY_TEST'
    };

    // Make the request to the final endpoint
    const response = await axios.post('https://app.socialinsider.io/api', body, { headers });

    // Send the response from the final endpoint to the client
    res.json(response.data);
  } catch (error) {
    // Handle any errors that occur during the request
    // console.error(error);
    res.status(500).json({ error: 'An error occurred' });
  }
});
const isImageLink = (link) => {
  const imageExtensions = /\.(jpg|jpeg|png|gif|bmp)(\?.*)?$/i;
  return imageExtensions.test(link);
};

async function convertToGrayscaleBase64(imageUrl) {
  try {
    const response = await axios.get(imageUrl, { responseType: 'arraybuffer' });
    const buffer = Buffer.from(response.data, 'binary');

    const grayscaleBuffer = await sharp(buffer)
      .grayscale()
      .toBuffer();

    const base64Image = grayscaleBuffer.toString('base64');
    return base64Image;
  } catch (error) {
    console.error(`Error fetching or converting image: ${error}`);
    return null;
  }
}

app.post('/posts', async (req, res) => {
  const { profiles, startDate, endDate } = req.body;

  try {
    var arrOfPosts = [];
    var totalPosts = 0;
    for (const profile of profiles) {
      const requestData = {
        jsonrpc: '2.0',
        id: 0,
        method: 'socialinsider_api.get_posts',
        params: {
          id: profile.id,
          profile_type: profile.profile_type,
          date: {
            start: convertDateToTimestamp(startDate),
            end: convertDateToTimestamp(endDate),
            timezone: 'Europe/London',
          },
          projectname: 'API_test',
          from: 0,
          size: 10,
        },
      };

      const response = await axios.post('http://localhost:3001/api', requestData);
      totalPosts += response.data.resp.total;
      const posts = response.data.resp.posts;

      while (arrOfPosts.length < 10) {
        if (posts.length === 0) {
          // Handle the case when the second array is empty
          break;
        }

        const post = posts.shift(); // Remove the first element from the second array

        if (post.picture) {
          if (isImageLink(post.picture)) {

            // Download the image and convert it to black and white
            const imageResponse = await axios.get(post.picture, { responseType: 'arraybuffer' });
            const blackAndWhiteImageBuffer = await sharp(imageResponse.data).greyscale().toBuffer();

            // Encode the black and white image to base64
            const base64ImageData = base64.fromByteArray(blackAndWhiteImageBuffer);

            // Create the image object with the base64 data
            const imageObject = {
              url: post.picture,
              base64: base64ImageData,
            };

            // Add the image object to the array of posts
            arrOfPosts.push({ ...post, picture: imageObject });
          } else {
            arrOfPosts.push({ ...post });
          }
        }
      }
    }

    res.send({ total: totalPosts, posts: arrOfPosts });
  } catch (error) {
    console.error(error);
    res.sendStatus(500);
  }
});


app.post('/statistics', async (req, res) => {
  var { profiles, startDate, endDate } = req.body;

  try {
    var arrResponse = []
    for (const profile of profiles) {
      const requestData = {
        jsonrpc: '2.0',
        id: 0,
        method: 'socialinsider_api.get_profile_data',
        params: {
          id: profile.id,
          profile_type: profile.profile_type,
          date: {
            start: convertDateToTimestamp(startDate),
            end: convertDateToTimestamp(endDate),
            timezone: 'Europe/London',
          },
          projectname: 'API_test',
          from: 0,
          size: 10,
        },
      };

      const response = await axios.post('http://localhost:3001/api', requestData);
      arrResponse.push({
        [profile.profile_type]: response.data.resp[profile.id]
      })

    }

    const totalEngagementPerDay = {};

    // Iterate over each object in 'socialMediaData'
    for (const obj of arrResponse) {
      // Extract the social media platform name (e.g., 'facebook_page', 'instagram_profile')
      const platform = Object.keys(obj)[0];

      // Extract the data for the current platform
      const platformData = obj[platform];

      // Iterate over each day's data in the platformData object
      for (const day in platformData) {
        if (platformData.hasOwnProperty(day)) {
          const data = platformData[day];
          const date = data.date;
          const engagement = data.engagement;

          // Check if the current day's engagement is already present in the 'totalEngagementPerDay' object
          if (totalEngagementPerDay.hasOwnProperty(date)) {
            // If present, add the current day's engagement to the existing total
            totalEngagementPerDay[date] += engagement;
          } else {
            // If not present, initialize the total with the current day's engagement
            totalEngagementPerDay[date] = engagement;
          }
        }
      }
    }
  
    res.send({ total: totalEngagementPerDay, ...arrResponse })

  } catch (error) {
    console.error(error);
    res.sendStatus(500);
  }
});

app.listen(port, () => {
  console.log(`Server is running on port ${port}`);
});