// Pure reference serialization. UI, downloads and credentials stay in app.js.
(function (root) {
  function bibtexEscape(text) {
    return String(text || "")
      .replace(/[{}\\]/g, (m) => `\\${m}`)
      .replace(/\s+/g, " ")
      .trim();
  }
  
  function bibtexCiteKey(paper) {
    const first = ((paper.authors || [])[0]?.name || "anon").split(/\s+/).pop() || "anon";
    const year = paper.year || "n.d.";
    const slug = (paper.title || "").toLowerCase().replace(/[^a-z0-9]+/g, "").slice(0, 12) || "paper";
    return `${first.toLowerCase().replace(/[^a-z0-9]/g, "")}${year}${slug}`;
  }
  
  function paperToBibTeX(paper) {
    const type = /thesis|dissertation/i.test(paper.venue || "") ? "phdthesis"
      : /proceedings|conf|workshop|symposium/i.test(paper.venue || "") ? "inproceedings"
      : paper.venue ? "article"
      : "misc";
    const key = bibtexCiteKey(paper);
    const fields = [];
    const push = (k, v) => { if (v != null && String(v).trim() !== "") fields.push(`  ${k} = {${bibtexEscape(v)}}`); };
    push("title", paper.title);
    const authorList = (paper.authors || []).map((a) => a.name || a).filter(Boolean).join(" and ");
    push("author", authorList);
    push("year", paper.year);
    if (type === "inproceedings") push("booktitle", paper.venue);
    else push("journal", paper.venue);
    push("url", paper.url);
    push("doi", paper.external_ids?.DOI || paper.doi);
    push("abstract", paper.abstract || paper.digest?.hook);
    const noteParts = [];
    if (paper.match_score != null) noteParts.push(`match=${paper.match_score}`);
    if (paper.read_minutes) noteParts.push(`read=${paper.read_minutes}min`);
    noteParts.push("via PaperSwipe");
    push("note", noteParts.join("; "));
    return `@${type}{${key},\n${fields.join(",\n")}\n}`;
  }

  function toBibTeXDocument(papers, date) {
    const usedKeys = new Map();
    const body = papers.map((paper) => {
      const bib = paperToBibTeX(paper);
      return bib.replace(/@(\w+)\{([^,]+),/, (match, type, key) => {
        const n = (usedKeys.get(key) || 0) + 1;
        usedKeys.set(key, n);
        return `@${type}{${n > 1 ? `${key}${n}` : key},`;
      });
    }).join("\n\n");
    const header = `% Exported from PaperSwipe · ${date}\n% ${papers.length} paper${papers.length > 1 ? "s" : ""}\n\n`;
    return header + body + "\n";
  }

  function paperToZoteroItem(paper, topics = []) {
    const venue = paper.venue || "";
    const isConf = /proceedings|conf|workshop|symposium/i.test(venue);
    const isThesis = /thesis|dissertation/i.test(venue);
    const isPreprint = /arxiv|preprint|biorxiv|medrxiv/i.test(venue);
    const itemType = isThesis ? "thesis" : isConf ? "conferencePaper" : isPreprint ? "preprint" : venue ? "journalArticle" : "document";
    const creators = (paper.authors || []).map((a) => {
      const name = a.name || a || "";
      const parts = name.trim().split(/\s+/);
      if (parts.length <= 1) return { creatorType: "author", lastName: name, firstName: "" };
      return { creatorType: "author", firstName: parts.slice(0, -1).join(" "), lastName: parts[parts.length - 1] };
    });
    const tags = topics.slice(0, 12).map((tag) => ({ tag }));
    const item = {
      itemType,
      title: paper.title || "",
      creators,
      date: paper.year ? String(paper.year) : "",
      url: paper.url || paper.pdf_url || "",
      abstractNote: paper.digest?.tldr || paper.abstract || "",
      tags,
      extra: [
        paper.doi ? `DOI: ${paper.doi}` : "",
        paper.match_score != null ? `PaperSwipe match: ${paper.match_score}` : "",
        paper.read_minutes ? `PaperSwipe read: ${paper.read_minutes} min` : "",
        "via PaperSwipe",
      ].filter(Boolean).join("\n"),
    };
    if (itemType === "journalArticle") item.publicationTitle = venue;
    else if (itemType === "conferencePaper") item.proceedingsTitle = venue;
    else if (itemType === "thesis") item.university = venue;
    else if (itemType === "preprint") item.repository = venue;
    if (paper.external_ids?.DOI || paper.doi) item.DOI = paper.external_ids?.DOI || paper.doi;
    return item;
  }

  root.PaperSwipeBibliography = Object.freeze({
    toBibTeX: paperToBibTeX, toBibTeXDocument, toZoteroItem: paperToZoteroItem,
  });
})(globalThis);
