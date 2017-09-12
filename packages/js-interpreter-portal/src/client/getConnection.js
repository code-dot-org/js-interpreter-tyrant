import io from 'socket.io-client';

let connection, socket;
export default function getConnection() {
  if (!process.env.IS_CLIENT) {
    throw new Error('You can only create a client connection on the client');
  }
  if (!connection) {
    connection = io();
  }
  return connection;
}
