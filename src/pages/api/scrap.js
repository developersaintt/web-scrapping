import puppeteer from "puppeteer";

export default async function handler(req, res) {
  let browser = null;
  try {
    browser = await puppeteer.launch({
      // args: ["--no-sandbox", "--disable-setuid-sandbox", "--headless=new"],
      headless: "new",
      args: ["--no-sandbox", "--disable-setuid-sandbox"],
    });

    if (!req.query.url)
      return res.status(400).json({ error: "url is required" });

    const page = await browser.newPage();
    await page.goto(
      req.query.url,
      // "https://www.fragrantica.com/perfume/Francesca-Bianchi/Sex-And-The-Sea-Neroli-54515.html",
      // "https://www.fragrantica.com/perfume/New-York-Yankees/New-York-Yankees-14600.html",
      { waitUntil: "domcontentloaded" }
    );

    // Accords
    const accordBoxData = await page.$$eval(".accord-box", (elements) =>
      elements.map((el) => ({
        [el.textContent.trim()]: (
          parseFloat(el.querySelector(".accord-bar").style.width) / 10
        ).toFixed(2),
      }))
    );

    // Seasons
    await page.waitForSelector("#rating + div + div > div + div [index]");
    const seasons = await page.evaluate(() => {
      return Array.from(
        document.querySelectorAll("#rating + div + div > div + div [index]")
      ).map((itm) => {
        return {
          [itm.innerText]: (
            parseFloat(
              itm.querySelector(".voting-small-chart-size div div").style.width
            ) / 10
          ).toFixed(2),
        };
      });
    });

    // Notes
    await page.waitForSelector("#pyramid");
    const notes = await page.evaluate(() => {
      const headings = Array.from(document.querySelectorAll("#pyramid h4"));
      if (headings.length === 0) {
        let notesWrapper = document
          .querySelector(".notes-box")
          .nextElementSibling.querySelector("div").children;

        return {
          "Base Notes": Array.from(notesWrapper).map((node) => {
            return {
              text: node.textContent.trim(),
              img: node.querySelector("img").src,
            };
          }),
        };
      }
      const extractNotes = (headingText) => {
        const headingNode = headings.find((node) =>
          node.textContent.includes(headingText)
        );
        if (!headingNode) return [];
        let notesWrapper =
          headingNode.nextElementSibling.querySelector("div").children;

        return {
          [headingText]: Array.from(notesWrapper).map((node) => {
            return {
              text: node.textContent.trim(),
              img: node.querySelector("img").src,
            };
          }),
        };
      };
      const topNotes = extractNotes("Top Notes");
      const middleNotes = extractNotes("Middle Notes");
      const baseNotes = extractNotes("Base Notes");
      return {
        ...topNotes,
        ...middleNotes,
        ...baseNotes,
      };
    });

    // Description

    await page.waitForSelector("[itemprop='description']");
    const description = await page.evaluate(() => {
      document
        .querySelector("[itemprop='description']")
        .querySelector(".reviewstrigger").innerHTML = "";
      return document.querySelector("[itemprop='description']").textContent;
    });

    await browser.close();

    res.status(200).json({
      notes,
      seasons: { ...seasons.reduce((acc, obj) => ({ ...acc, ...obj }), {}) },
      description,
      accordBoxData: {
        ...accordBoxData.reduce((acc, obj) => ({ ...acc, ...obj }), {}),
      },
    });
  } catch (error) {
    if (browser) await browser.close();
    res.status(500).json({ error });
  }
}
