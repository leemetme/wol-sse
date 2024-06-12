#include <WiFi.h>
#include <WiFiUdp.h>
#include <WiFiClient.h>
#include <WiFiClientSecure.h>
#include <WakeOnLan.h>

const char* ssid = "";  // the SSID of the Wi-Fi network you want your ESP to operate in
const char* password = "";  // the password of the Wi-Fi network you want your ESP to operate in
const char* remoteServer = "";  // the SSE server to connect to, can be something like "google.com" or an IP address
const int remoteServerPort = 443;  // the port on the SSE server to connect to.
const char* token = "CHANGE-ME";  // the authorization token to provide in the web request to the SSE server
const char* hostHeader = "";  // the value to put into the HTTP Host header. a server can host multiple websites, so you identify which domain you're visiting here

WiFiUDP UDP;
WakeOnLan WOL(UDP);
WiFiClientSecure client;

void wakeThisMAC(char* MACAddress) {
  WOL.setRepeat(3, 100);
  WOL.calculateBroadcastAddress(WiFi.localIP(), WiFi.subnetMask());
  WOL.sendMagicPacket(MACAddress); // Port 9 by default.
  Serial.print("Sent magic packet to: ");
  Serial.print(MACAddress);
  Serial.println("!");
}

void connectToWiFi() {
  Serial.print("Connecting to ");
  Serial.println(ssid);
  WiFi.begin(ssid, password);
  while (WiFi.status() != WL_CONNECTED) {
    delay(500);
    Serial.print(".");
  }
}

void connectSSE() {
  Serial.println("\nStarting connection to server...");
  if (!client.connect(remoteServer, remoteServerPort)) {
    Serial.println("Connection failed!");
  } else {
    Serial.println("Connected to server!");
    
    client.println("GET /sse/events HTTP/1.1");
    client.print("Host: ");
    client.println(hostHeader);
    client.print("Authorization: Bearer ");
    client.println(token);
    client.println("User-Agent: SSE WakeOnLan Listener via ESP32");
    client.println("Accept: text/event-stream");
    client.println();

    while (client.connected()) {
      String line = client.readStringUntil('\n');
      if (line != "\r" && line != "" && line != "data: PING") {
        Serial.println(line);
      }
      if (line.startsWith("data: ")) {
        String data = line.substring(6);
        if (data.startsWith("SEND_PACKET_TO_MAC")) {
          Serial.println("Received magic packet request.");
          String macString = data.substring(19);
          if (macString.endsWith("\r")) {
            macString = macString.substring(0, macString.length() - 1);
          }
          Serial.print("Here's the MAC: `");
          Serial.print(macString);
          Serial.println("`");
          if (macString.length() == 17) {
            unsigned char macStringBytes[18];
            macString.getBytes(macStringBytes, 18);
            wakeThisMAC(reinterpret_cast<char*>(macStringBytes));
          } else {
            Serial.println("Incorrect length for MAC. :(");
          }
        }
      }
    }

    client.stop();
  }
}

void setup() {
  Serial.begin(115200);

  Serial.print("MAC address of ESP32: ");
  Serial.println(WiFi.macAddress());

  connectToWiFi();
  Serial.println("");
  Serial.println("WiFi connected.");
  Serial.print("IP address: ");
  Serial.println(WiFi.localIP());

  client.setInsecure();
  connectSSE();
}

void loop() {
  if (WiFi.status() != WL_CONNECTED) {
    connectToWiFi();
  }
  if (!client.connected()) {
    delay(60000);
    connectSSE();
  }
}
