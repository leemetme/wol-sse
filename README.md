# Wake-on-LAN without port forwarding*

Turn on your devices remotely with an ESP32; this setup does not require you
to have port forwarding access in the Wi-Fi network you want to wake up
your devices in.

We achieve this by hosting an HTTP server that facilitates a connection
between the user (who wants to turn on the computer) and the ESP;
the ESP stays connected to the server listening for events
(using [Server-Side Events](https://en.wikipedia.org/wiki/Server-sent_events)).

What you'll need to set this up:
- A spare ESP32, ESP8266, or any other similar microcontroller with Wi-Fi that you can run Arduino code in.
- A server that has port forwarding access and can run Node.JS files. May be hosted anywhere in the world.

## Setup tutorial
### Server configuration

Install Node.JS on your server if you haven't already.

Edit the following things in the `wol_sse_server.js` file.
- `const HTTP_PORT` ...edit this variable directly or provide an environment variable `HTTP_PORT` when booting up to define the port the HTTP server will be hosted in.
- `const config` ...remove the examples from the dictionary and add a new configuration with your preffered name

Example configuration
```js
const config = {
  "HOME": {
    bearer: "blablablabla"  // generate a hard to guess password here!
  }
}
```

In this case `"blablablabla"` will be our "token" or "password"
when we set up the ESP and when we want to send the magic packet.
`"HOME"` is just how we identify the token with a human-friendly name in the application.

You should consider making your bearer token something hard to guess.
The following generates a random string.

```js
const crypto = require("crypto");
console.log(crypto.randomBytes(16).toString("hex"));
```

You can have multiple configurations under the configuration object.
Simply add another key and value to the dictionary. Suppose I have two ESPs,
one at work, one at home. Here's an example configuration if I had two ESPs:
```js
const config = {
  "HOME": { bearer: "blablablabla" },
  "WORK": { bearer: "albalbalbalb" }
}
```

Later on, I'd supply `blablablabla` for the home ESP as the token and
`albalbalbalb` as the token for the work ESP.

Once you've got your file setup, install a dependency called "Express" for our application.
To do that, navigate to the folder where you have `wol_sse_server.js` on the command line,
and type the command `npm install express`.

Afterwards, use something like `pm2` to constantly
keep the `wol_sse_server.js` file running, and use a reverse proxy like `nginx`
to host your HTTP server. I'd implore you to host the website using HTTPS.

Once you've got it setup, you should be able to go to `https://[your address and port]/sse/status`
and see `{"listenerCount": 0}`.

## ESP configuration

Boot up the Arduino IDE and install the [`WakeOnLan` library](https://github.com/a7md0/WakeOnLan) by the amazing (a7md0)[https://github.com/a7md0].
Install libraries in the Arduino IDE using the library manager in the left sidebar.

Open the `wol_sse.ino` file in the Arduino IDE and edit the constants at the beginning of the file.

If you're using an HTTP server, such as when testing in your local network, you'll want to replace some of the code.
- replace `WiFiClientSecure client;` with `WiFiClient client;`
- delete this: `client.setInsecure();`

Upload the code to your microcontroller. If successfully connected, you should see a message in the logs of the Node.JS application.

# Usage

```sh
curl https://[your address and port]/sse/[MAC address]/on -X POST -H "Authorization: Bearer [your token]
```

For example, if my computer was connected to the Wi-Fi with a MAC address `AB:CD:EF:12:34:56`,
and the ESP in that network was connected to the HTTP server with the token `blablablabla`...

```sh
curl https://[your address and port]/sse/AB:CD:EF:12:34:56/on -X POST -H "Authorization: Bearer blablablabla"
```

You can make this even cooler on Apple iOS devices by creating a Shortcut using the built-in Shortcuts app.

1. Make a new shortcut
2. Add the "Get contents of URL" into it.
3. Set the URL to `https://[your address and port]/sse/[MAC address]/on`.
4. Set the method to `POST`
5. Add a header, where the key is `Authorization` and the value is `Bearer [your token]`.

Now you can add the created shortcut to your home screen.
Tapping the shortcut will make you turn on your computer - anywhere you are!

Enjoy :)
