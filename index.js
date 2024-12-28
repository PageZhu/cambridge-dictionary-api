const cheerio = require("cheerio");
const axios = require("axios");

const fetchVerbs = (wiki) => {
  return new Promise((resolve, reject) => {
    axios
      .get(wiki)
      .then((response) => {
        const $$ = cheerio.load(response.data);
        const verb = $$("tr > td > p ").text();

        const lines = verb
          .split("\n")
          .map((line) => line.trim())
          .filter(Boolean);

        const verbs = [];
        for (let i = 0; i < lines.length; i += 2) {
          const type = lines[i];
          const text = lines[i + 1];
          if (type && text) {
            verbs.push({ id: verbs.length, type, text });
          }
        }
        resolve(verbs);
      })
      .catch((error) => {
        resolve([]);
      });
  });
};

exports.handler = async function (event, context) {
  const entry = event.path.split("/")[4]; // 获取请求的单词
  let nation = "us";
  let language = "english";

  // 解析路径中的语言
  if (event.path.includes("uk")) {
    nation = "uk";
  }

  const url = `https://dictionary.cambridge.org/${nation}/dictionary/${language}/${entry}`;
  try {
    const response = await axios.get(url);
    const $ = cheerio.load(response.data);
    const siteurl = "https://dictionary.cambridge.org";
    const wiki = `https://simple.wiktionary.org/wiki/${entry}`;

    const verbs = await fetchVerbs(wiki);

    // 基本信息
    const word = $(".hw.dhw").first().text();
    const getPos = $(".pos.dpos")
      .map((index, element) => $(element).text())
      .get();
    const pos = getPos.filter((item, index) => getPos.indexOf(item) === index);

    // 发音
    const audio = [];
    $(".pos-header.dpos-h").each((_, s) => {
      const posNode = $(s)
        .find(".dpos-g")
        .first();
      const p = $(posNode).text();
      $(s)
        .find(".dpron-i")
        .each((_, node) => {
          const lang = $(node).find("span").first().text();
          const url = $(node).find("audio source").attr("src");
          if (url) {
            audio.push({ pos: p, lang: lang, url: siteurl + url });
          }
        });
    });

    // 词汇定义与例句
    const definition = $(".def-block.ddef_block")
      .map((index, element) => ({
        id: index,
        pos: $(element).find(".pos.dpos").first().text(),
        text: $(element).find(".def.ddef_d.db").text(),
        translation: $(element).find(".def-body.ddef_b span.trans.dtrans").text(),
      }))
      .get();

    if (!word) {
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
      body: JSON.stringify({ error: "Internal server error" }),
    };
  }
};
