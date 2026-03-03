const puppeteer = require('puppeteer');
const logger = require('../utils/logger');

function buildResumeHTML(resume) {
  const skillsList = [
    ...(resume.skills?.technical || []),
    ...(resume.skills?.tools || []),
    ...(resume.skills?.soft || [])
  ].join(' • ');

  const experienceHTML = (resume.experience || []).map(exp => `
    <div class="experience-item">
      <div class="exp-header">
        <div>
          <div class="job-title">${exp.title}</div>
          <div class="company">${exp.company}${exp.location ? ` · ${exp.location}` : ''}</div>
        </div>
        <div class="dates">${exp.start_date} – ${exp.end_date}</div>
      </div>
      <ul class="achievements">
        ${(exp.achievements || []).map(a => `<li>${a}</li>`).join('')}
      </ul>
    </div>
  `).join('');

  const educationHTML = (resume.education || []).map(edu => `
    <div class="education-item">
      <div class="exp-header">
        <div>
          <div class="job-title">${edu.degree}</div>
          <div class="company">${edu.institution}${edu.location ? ` · ${edu.location}` : ''}</div>
          ${edu.gpa ? `<div class="gpa">GPA: ${edu.gpa}</div>` : ''}
        </div>
        <div class="dates">${edu.graduation_year}</div>
      </div>
    </div>
  `).join('');

  const certificationsHTML = (resume.certifications || []).length > 0 ? `
    <section class="section">
      <h2 class="section-title">Certifications</h2>
      <div class="certs">
        ${resume.certifications.map(c => `
          <div class="cert-item">
            <span class="cert-name">${c.name}</span>
            <span class="cert-issuer">${c.issuer} · ${c.year}</span>
          </div>
        `).join('')}
      </div>
    </section>
  ` : '';

  const projectsHTML = (resume.projects || []).length > 0 ? `
    <section class="section">
      <h2 class="section-title">Projects</h2>
      ${resume.projects.map(p => `
        <div class="project-item">
          <div class="project-header">
            <span class="project-name">${p.name}</span>
            ${p.link ? `<a href="${p.link}" class="project-link">${p.link}</a>` : ''}
          </div>
          <div class="project-desc">${p.description}</div>
          <div class="project-tech">${(p.technologies || []).join(' · ')}</div>
        </div>
      `).join('')}
    </section>
  ` : '';

  return `
<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<style>
  * { margin: 0; padding: 0; box-sizing: border-box; }
  body {
    font-family: 'Georgia', serif;
    font-size: 10pt;
    color: #1a1a1a;
    line-height: 1.5;
    padding: 36px 48px;
    max-width: 850px;
    margin: 0 auto;
  }
  .header { border-bottom: 2px solid #1a1a1a; padding-bottom: 12px; margin-bottom: 16px; }
  .name { font-size: 22pt; font-weight: bold; letter-spacing: 1px; text-transform: uppercase; }
  .contact {
    display: flex;
    flex-wrap: wrap;
    gap: 8px 20px;
    margin-top: 6px;
    font-size: 9pt;
    color: #444;
  }
  .contact a { color: #1a5276; text-decoration: none; }
  .section { margin-bottom: 16px; }
  .section-title {
    font-size: 11pt;
    font-weight: bold;
    text-transform: uppercase;
    letter-spacing: 1.5px;
    border-bottom: 1px solid #ccc;
    padding-bottom: 3px;
    margin-bottom: 10px;
    color: #1a5276;
  }
  .summary { font-size: 10pt; color: #333; line-height: 1.6; }
  .skills-list { font-size: 9.5pt; color: #333; line-height: 1.8; }
  .experience-item, .education-item { margin-bottom: 12px; }
  .exp-header {
    display: flex;
    justify-content: space-between;
    align-items: flex-start;
  }
  .job-title { font-weight: bold; font-size: 10.5pt; }
  .company { color: #555; font-size: 9.5pt; }
  .dates { font-size: 9pt; color: #666; white-space: nowrap; margin-left: 12px; }
  .achievements {
    margin-top: 5px;
    padding-left: 16px;
    font-size: 9.5pt;
    color: #333;
  }
  .achievements li { margin-bottom: 3px; }
  .gpa { font-size: 9pt; color: #666; }
  .certs { display: flex; flex-direction: column; gap: 5px; }
  .cert-item { display: flex; justify-content: space-between; font-size: 9.5pt; }
  .cert-name { font-weight: bold; }
  .cert-issuer { color: #666; }
  .project-item { margin-bottom: 10px; }
  .project-header { display: flex; justify-content: space-between; }
  .project-name { font-weight: bold; font-size: 10pt; }
  .project-link { font-size: 8.5pt; color: #1a5276; }
  .project-desc { font-size: 9.5pt; color: #333; margin-top: 2px; }
  .project-tech { font-size: 9pt; color: #666; margin-top: 3px; font-style: italic; }
</style>
</head>
<body>
  <header class="header">
    <div class="name">${resume.name}</div>
    <div class="contact">
      ${resume.email ? `<span>${resume.email}</span>` : ''}
      ${resume.phone ? `<span>${resume.phone}</span>` : ''}
      ${resume.location ? `<span>${resume.location}</span>` : ''}
      ${resume.linkedin ? `<a href="${resume.linkedin}">LinkedIn</a>` : ''}
      ${resume.portfolio ? `<a href="${resume.portfolio}">Portfolio</a>` : ''}
    </div>
  </header>

  ${resume.summary ? `
  <section class="section">
    <h2 class="section-title">Professional Summary</h2>
    <p class="summary">${resume.summary}</p>
  </section>` : ''}

  ${skillsList ? `
  <section class="section">
    <h2 class="section-title">Skills</h2>
    <div class="skills-list">${skillsList}</div>
  </section>` : ''}

  ${(resume.experience || []).length > 0 ? `
  <section class="section">
    <h2 class="section-title">Experience</h2>
    ${experienceHTML}
  </section>` : ''}

  ${(resume.education || []).length > 0 ? `
  <section class="section">
    <h2 class="section-title">Education</h2>
    ${educationHTML}
  </section>` : ''}

  ${certificationsHTML}
  ${projectsHTML}
</body>
</html>`;
}

async function generateResumePDF(resumeData) {
  logger.debug('Generating resume PDF');
  let browser;
  try {
    browser = await puppeteer.launch({
      headless: 'new',
      args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage']
    });
    const page = await browser.newPage();
    const html = buildResumeHTML(resumeData);
    await page.setContent(html, { waitUntil: 'networkidle0' });
    const pdf = await page.pdf({
      format: 'A4',
      printBackground: true,
      margin: { top: '0', bottom: '0', left: '0', right: '0' }
    });
    return pdf;
  } finally {
    if (browser) await browser.close();
  }
}

module.exports = { generateResumePDF, buildResumeHTML };
