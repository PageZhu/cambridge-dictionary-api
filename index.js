const cheerio = require("cheerio");
const axios = require("axios");

const fetchVerbs = (wiki) => {
  return new Promise((resolve, reject) => {
    axios
      .get(wiki, {
        timeout: 100000,
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36'
        }
      })
      .then((response) => {
        const $$ = cheerio.load(response.data);
        const verb = $$("tr > td > p ").text();

        const lines = verb
          .split("\n")
          .map((line) => line.trim())
          .filter(Boolean);

        const verbs = [];
        for (let i = 0; i < lines.length; i += 2) {
          if (verbs.includes({ type: lines[i], text: lines[i + 1] })) {
            break;
          }
          const type = lines[i];
          const text = lines[i + 1];
          if (type && text) {
            verbs.push({ id: verbs.length, type, text });
          } else {
            verbs.push();
          }
        }
        resolve(verbs);
      })
      .catch((error) => {
        resolve();
      });
  });
};

exports.handler = async (event, context) => {
  // Log the event object to inspect its structure
  console.log('Received event:', JSON.stringify(event, null, 2));

  // Check if pathParameters exists and contains the required keys
  const pathParameters = event.pathParameters || {};

  // If the path follows the pattern `/us/dictionary/{language}/{entry}`, 
  // we need to parse the `language` and `entry` from the path itself.
  const path = event.path || '';
  const pathParts = path.split('/').filter(Boolean);

  // Ensure the URL matches the expected format
  if (pathParts.length < 4) {
    return {
      statusCode: 400,
      body: JSON.stringify({ error: "Invalid path format, expected '/us/dictionary/{language}/{entry}'" }),
    };
  }

  const slugLanguage = pathParts[2];  // 'english' from /us/dictionary/english/example
  const entry = pathParts[3];  // 'example' from /us/dictionary/english/example

  // Validate if both language and entry are provided
  if (!slugLanguage || !entry) {
    return {
      statusCode: 400,
      body: JSON.stringify({ error: "Missing required parameters 'language' or 'entry'" }),
    };
  }

  let nation = pathParts[0] || 'us';  // Default to 'us' if not specified
  let language;

  // Determine the language and nation based on the request path
  if (slugLanguage === "en") {
    language = "english";
  } else if (slugLanguage === "uk") {
    language = "english";
    nation = "uk";
  } else if (slugLanguage === "en-tw") {
    language = "english-chinese-traditional";
  } else if (slugLanguage === "en-cn") {
    language = "english-chinese-simplified";
  } else {
    language = slugLanguage;
  }

  const url = `https://dictionary.cambridge.org/${nation}/dictionary/${language}/${entry}`;

  try {
    const response = await axios.get(url, {
      timeout: 100000,
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36'
      }
    });

    const $ = cheerio.load(response.data);
    const siteurl = "https://dictionary.cambridge.org";
    const wiki = `https://simple.wiktionary.org/wiki/${entry}`;

    // Fetch verbs
    const verbs = await fetchVerbs(wiki);

    // Word
    const word = $(".hw.dhw").first().text();

    // Part of Speech
    const getPos = $(".pos.dpos")
      .map((index, element) => $(element).text())
      .get();
    const pos = getPos.filter((item, index) => getPos.indexOf(item) === index);

    // Phonetics audios
    const audio = [];
    for (const s of $(".pos-header.dpos-h")) {
      const posNode = s.childNodes.find(
        (c) =>
          c.attribs && c.attribs.class && c.attribs.class.includes("dpos-g"),
      );
      if (!posNode || posNode.childNodes.length === 0) continue;
      const p = $(posNode.childNodes[0]).text();
      const nodes = s.childNodes.filter(
        (c) =>
          c.name === "span" &&
          c.attribs &&
          c.attribs.class &&
          c.attribs.class.includes("dpron-i"),
      );
      if (nodes.length === 0) continue;
      for (const node of nodes) {
        if (node.childNodes.length < 3) continue;
        const lang = $(node.childNodes[0]).text();
        const aud = node.childNodes[1].childNodes.find(
          (c) => c.name === "audio",
        );
        if (!aud) continue;
        const src = aud.childNodes.find((c) => c.name === "source");
        if (!src) continue;
        const url = siteurl + $(src).attr("src");
        const pron = $(node.childNodes[2]).text();
        audio.push({ pos: p, lang: lang, url: url, pron: pron });
      }
    }

    // Definition & example
    const exampleCount = $(".def-body.ddef_b")
      .map((index, element) => {
        const exampleElements = $(element).find(".examp.dexamp");
        return exampleElements.length;
      })
      .get();
    for (let i = 0; i < exampleCount.length; i++) {
      if (i == 0) {
        exampleCount[i] = exampleCount[i];
      } else {
        exampleCount[i] = exampleCount[i] + exampleCount[i - 1];
      }
    }

    const exampletrans = $(".examp.dexamp > .trans.dtrans.dtrans-se.hdb.break-cj"); // translation of the example
    const example = $(".examp.dexamp > .eg.deg")
      .map((index, element) => {
        return {
          id: index,
          text: $(element).text(),
          translation: exampletrans.eq(index).text(),
        };
      })
      .get();

    const source = (element) => {
      const defElement = $(element);
      const parentElement = defElement.closest(".pr.dictionary");
      const dataId = parentElement.attr("data-id");
      return dataId;
    };

    const defPos = (element) => {
      const defElement = $(element);
      const partOfSpeech = defElement
        .closest(".pr.entry-body__el")
        .find(".pos.dpos")
        .first()
        .text();
      return partOfSpeech;
    };

    const getExample = (element) => {
      const ex = $(element)
        .find(".def-body.ddef_b > .examp.dexamp")
        .map((index, element) => {
          return {
            id: index,
            text: $(element).find(".eg.deg").text(),
            translation: $(element).find(".trans.dtrans").text(),
          };
        });
      return ex.get();
    };

    const definition = $(".def-block.ddef_block")
      .map((index, element) => {
        return {
          id: index,
          pos: defPos(element),
          source: source(element),
          text: $(element).find(".def.ddef_d.db").text(),
          translation: $(element)
            .find(".def-body.ddef_b > span.trans.dtrans")
            .text(),
          example: getExample(element),
        };
      })
      .get();

    // API response
    if (word === "") {
      return {
        statusCode: 404,
        body: JSON.stringify({ error: "word not found" }),
      };
    }

    return {
      statusCode: 200,
      body: JSON.stringify({
        word: word,
        pos: pos,
        verbs: verbs,
        pronunciation: audio,
        definition: definition,
      }),
    };
  } catch (error) {
    return {
      statusCode: 500,
      body: JSON.stringify({ error: error.message }),
    };
  }
};
