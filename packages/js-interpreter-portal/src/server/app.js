import React from 'react';
import { renderToString } from 'react-dom/server';
import { ServerStyleSheet } from 'styled-components';
import { StaticRouter } from 'react-router';
import Helmet from 'react-helmet';

import AppWrapper from '../AppWrapper';

const ENABLE_SERVER_SIDE_RENDERING = false;

export default async (req, res) => {
  const context = {};
  const sheet = new ServerStyleSheet();
  let main = '';
  if (ENABLE_SERVER_SIDE_RENDERING) {
    main = renderToString(
      sheet.collectStyles(
        <StaticRouter location={req.url} context={context}>
          <AppWrapper />
        </StaticRouter>
      )
    );
  }
  const helmet = Helmet.renderStatic();

  if (context.url) {
    res.writeHead(301, {
      Location: context.url,
    });
    res.end();
    return;
  }
  res.write(
    `<!doctype html>
<html lang="en" ${helmet.htmlAttributes.toString()}>
<head>
  <meta charSet="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <link rel="manifest" href="manifest.json" />
  <link
    href="https://fonts.googleapis.com/icon?family=Material+Icons"
    rel="stylesheet"
  />
  <link
    href="https://cdnjs.cloudflare.com/ajax/libs/10up-sanitize.css/5.0.0/sanitize.min.css"
    rel="stylesheet"
  />
  <link rel="icon" type="image/png" href="/favicon.png" />
  <link
    href="https://fonts.googleapis.com/css?family=Roboto:100,300,400,500,700"
    rel="stylesheet"
  />

  <meta name="mobile-web-app-capable" content="yes" />
  ${helmet.title.toString()}
  ${helmet.meta.toString()}
  ${helmet.link.toString()}
  <style>
    html,
    body {
      height: 100%;
      width: 100%;
      line-height: 1.5;
      font-family: 'Roboto', 'Helvetica Neue', Helvetica, Arial, sans-serif;
    }
    #app {
      min-height: 100%;
    }
  </style>
  ${sheet.getStyleTags()}
  </head>
  <body ${helmet.bodyAttributes.toString()}>
    <noscript>
      If you're seeing this message, that means
      <strong>JavaScript has been disabled on your browser</strong>, please
      <strong>enable JS</strong> to make this app work.
    </noscript>
    <div
      id="app"
    >${main}</div>
    <script src="/main.js"></script>
  </body>
</html>
  `
  );
  res.end();
};
