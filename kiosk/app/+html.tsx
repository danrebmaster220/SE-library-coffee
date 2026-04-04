import { type PropsWithChildren } from "react";

/**
 * Web root document — full viewport height so flex layouts (phone menu) get a real height.
 * Without this, nested flex + ScrollView on RN Web often collapse to 0px on narrow screens.
 */
export default function Root({ children }: PropsWithChildren) {
  return (
    <html lang="en">
      <head>
        <meta charSet="utf-8" />
        <meta httpEquiv="X-UA-Compatible" content="IE=edge" />
        <meta
          name="viewport"
          content="width=device-width, initial-scale=1, shrink-to-fit=no"
        />
        <style
          dangerouslySetInnerHTML={{
            __html: `
html, body {
  height: 100%;
  margin: 0;
}
#root {
  height: 100%;
  display: flex;
  flex-direction: column;
  min-height: 0;
}
/* Expo / Metro web may mount under a div that is not #root */
body > div {
  flex: 1;
  display: flex;
  flex-direction: column;
  min-height: 0;
  height: 100%;
}
body {
  display: flex;
  flex-direction: column;
  min-height: 100%;
}
`,
          }}
        />
      </head>
      <body>{children}</body>
    </html>
  );
}
