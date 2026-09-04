import Head from 'next/head';
import '../styles/globals.css';

export default function App({ Component, pageProps }) {
  return (
    <>
      <Head>
        <title>Unframe Ambassador Portal</title>
        <meta name="description" content="Unframe partner ambassador portal" />
        <link rel="icon" type="image/svg+xml" href="/logo-dark.svg" />
      </Head>
      <Component {...pageProps} />
    </>
  );
}
