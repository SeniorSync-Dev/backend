import mqtt, { MqttClient } from "mqtt";


const clientId = `mqttBackend_${Math.random().toString(16).slice(3)}`;




let client: MqttClient | null = null;

export function getClient(): MqttClient | null {
    return client;
}

export function connectMqtt(): MqttClient {
    const host = process.env.MQTT_BROKER_URL;
    const username = process.env.MQTT_USERNAME;
    const password = process.env.MQTT_PASSWORD;

    const options = {
        keepalive: 60,
        clientId,
        protocolId: 'MQTT' as const,
        protocolVersion: 5 as const,
        port: 8883,
        clean: true,
        reconnectPeriod: 1000,
        connectTimeout: 30 * 1000,
        username: username,
        password: password,
        will: {
            topic: "backend/connection",
            payload: "Connection Closed abnormally..! backend will be disconnected..!",
            qos: 1 as const,
            retain: false,
        },
        rejectUnauthorized: false,
    };

    if (client) {
        return client;
    }

    if (!host) {
        throw new Error("MQTT_BROKER_URL is not defined in environment variables.");
    }

    if (!username || !password) {
        throw new Error("MQTT_USERNAME or MQTT_PASSWORD is not defined in environment variables.");
    }

    console.log('connecting mqtt client to host:', host, 'with clientId:', clientId);
    client = mqtt.connect(host, options);

    client.on('error', (err) => {
        console.log(err);
        client?.end();
        client = null;
    });

    client.on('connect', () => {
        console.log('client connected: ' + clientId);
        client?.subscribe('seniorsync/fallsensor/status/#', { qos: 2 });
        client?.subscribe('seniorsync/fallsensor/fall/#', { qos: 2 });
    });

    client.on('message', async (topic, message, packet) => {
        try {
            switch (topic) {
                case 'seniorsync/fallsensor/status/':
                    console.log(`Received status message: ${message.toString()}`);
                    break;
                case 'seniorsync/fallsensor/fall/':
                    console.log(`Received fall message: ${message.toString()}`);
                    // handle sensor messages
                    break;
                default:
                    console.log(`Received message on unknown topic: ${topic}`);
            }

            // Optional: skip duplicated re-delivery
            if (packet.dup) return;
        } catch (err) {
            console.error('Failed to parse message:', err);
        }
    });

    client.on('close', () => {
        console.log(clientId + ' disconnected');
        client = null;
    });

    return client;
}
