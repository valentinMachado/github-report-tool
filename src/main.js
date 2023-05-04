const Octokit = require("octokit").Octokit;
const fs = require("fs");
const privateData = require("../private.json")

const main = async () => {
  const octokit = new Octokit({
    auth: privateData.token,
  });

  const today = new Date();
  const oneWeekAgo = new Date();
  oneWeekAgo.setDate(today.getDate() - 7);

  const depth = 50;
  const login = "valentinMachado";

  class RepoLog {
    constructor(name) {
      this.name = name;
      this.issueComments = [];
      this.issueContributions = [];
      this.pullRequestCreated = [];
      this.pullRequestReviewed = [];
      this.discussions = [];
      this.branches = [];
      this.questions = [];
    }

    createSectionComment(label, array, character="x") {
      if (!array.length) return "";

      let listUrl = "";
      array.forEach((el, index) => {
        if(character){
          listUrl += ` <a title="${el.title}" href="${el.url}">${character}</a>`;
        }else{
          listUrl += ` <a title="${el.title}" href="${el.url}">${index + 1}</a>`;
        }
      });
      let result = `<li>${label}: ${listUrl}</li>`;

      result = `<script>console.log("${this.name,label}")</script>`

      return result;
    }

    toRowMD() {
      let comment = "";
      comment += this.createSectionComment(
        "Issue comments",
        this.issueComments
      );
      comment += this.createSectionComment(
        "Issue created",
        this.issueContributions
      );
      comment += this.createSectionComment(
        "PR created",
        this.pullRequestCreated
      );
      comment += this.createSectionComment(
        "PR reviewed",
        this.pullRequestReviewed
      );
      comment += this.createSectionComment("Working branches", this.branches);
      comment += this.createSectionComment("Discussions", this.discussions);
      comment += this.createSectionComment("Ongoing questions", this.questions, "?");

      return `|${this.name}| ? | ? | ${comment} |`;
    }
  }

  /** @type {Object<string,RepoLog>} */
  const reposLog = {};

  const result = await octokit.graphql(`{
  viewer {
    issueComments(last:${depth}) {
      nodes {
        issue{
          repository{
            name
          }
          title
          url
        }
        publishedAt
        author{
          login
        }
      }
    }
    contributionsCollection(from: "${oneWeekAgo.toISOString()}", to: "${today.toISOString()}") {  
      issueContributions(first: ${depth}){
        nodes{
          issue{
            repository{
              name
            }
            url
            title
          }
        }
      }
      pullRequestContributions(first: ${depth}){
        nodes{
          pullRequest{
            repository{
              name
            }
            url
            title
          }
        }
      }
      pullRequestReviewContributions(first: ${depth}){
        nodes{
          pullRequest{
            repository{
              name
            }
            url
            title
          }
        }
      }
    }
  }

  repository(owner:"itowns" name: "itowns"){
    discussions(first: ${depth}){
      nodes{
        title
        publishedAt
        url
        author{
          login
        }
        comments(last:${depth}){
          nodes{
            publishedAt
            url
            author{
              login
            }
            replies(last:${depth}){
              nodes{
                publishedAt
                url
                author{
                  login
                }
              }
            }
          }
        }
      }
    }
  }
}`);

  if (result.viewer.contributionsCollection.issueContributions.nodes.length) {
    result.viewer.contributionsCollection.issueContributions.nodes.forEach(
      (node) => {
        console.log(node);
        if (!reposLog[node.issue.repository.name]) {
          reposLog[node.issue.repository.name] = new RepoLog(
            node.issue.repository.name
          );
        }

        reposLog[node.issue.repository.name].issueContributions.push({
          title: node.issue.title,
          url: node.issue.url,
        });
      }
    );
  }

  if (
    result.viewer.contributionsCollection.pullRequestContributions.nodes.length
  ) {
    result.viewer.contributionsCollection.pullRequestContributions.nodes.forEach(
      (node) => {
        console.log(node);
        if (!reposLog[node.pullRequest.repository.name]) {
          reposLog[node.pullRequest.repository.name] = new RepoLog(
            node.pullRequest.repository.name
          );
        }

        reposLog[node.pullRequest.repository.name].pullRequestCreated.push({
          title: node.pullRequest.title,
          url: node.pullRequest.url,
        });
      }
    );
  }

  if (
    result.viewer.contributionsCollection.pullRequestReviewContributions.nodes
      .length
  ) {
    result.viewer.contributionsCollection.pullRequestReviewContributions.nodes.forEach(
      (node) => {
        console.log(node);
        if (!reposLog[node.pullRequest.repository.name]) {
          reposLog[node.pullRequest.repository.name] = new RepoLog(
            node.pullRequest.repository.name
          );
        }

        reposLog[node.pullRequest.repository.name].pullRequestReviewed.push({
          title: node.pullRequest.title,
          url: node.pullRequest.url,
        });
      }
    );
  }

  // parse discussion result
  const nodeShouldBeAdd = (node) => {
    const dateNode = new Date(node.publishedAt);
    return (
      dateNode.getTime() - oneWeekAgo.getTime() > 0 &&
      node.author.login == login
    );
  };
  const discussions = [];
  result.repository.discussions.nodes.forEach((discussionNode) => {
    if (nodeShouldBeAdd(discussionNode)) discussions.push(discussionNode);
    discussionNode.comments.nodes.forEach((commentNode) => {
      commentNode.title = discussionNode.title;
      if (nodeShouldBeAdd(commentNode)) discussions.push(commentNode);
      commentNode.replies.nodes.forEach((replieNode) => {
        replieNode.title = discussionNode.title;
        if (nodeShouldBeAdd(replieNode)) discussions.push(replieNode);
      });
    });
  });
  if (discussions.length) {
    if (!reposLog["itowns"]) reposLog["itowns"] = new RepoLog("itowns");
    discussions.forEach((node) => {
      console.log(node);
      reposLog["itowns"].discussions.push({
        title: node.title,
        url: node.url,
      });
    });
  }

  const issueToAdd = [];
  result.viewer.issueComments.nodes.forEach((node) => {
    if (nodeShouldBeAdd(node)) {
      if (issueToAdd.filter((el) => el.title == node.issue.title).length)
        return;

      issueToAdd.push(node.issue);
    }
  });
  if (issueToAdd.length) {
    issueToAdd.forEach((issue) => {
      console.log(issue);
      if (!reposLog[issue.repository.name]) {
        reposLog[issue.repository.name] = new RepoLog(issue.repository.name);
      }

      reposLog[issue.repository.name].issueComments.push({
        title: issue.title,
        url: issue.url,
      });
    });
  }

  const repoRequests = async (owner, name) => {

    const firstIssueResult = await octokit.graphql(`{
      repository(owner:"${owner}" name: "${name}"){
        issues(first: 100 states:OPEN){
          nodes{
            title
            url
            labels(last: 100){
              nodes{
                name
              }
            }
          }
        }
      }
    }`)

    const repoResult = await octokit.graphql(`
    {
      repository(owner:"${owner}" name: "${name}"){
        refs(last: ${depth} refPrefix: "refs/heads/"){
          nodes{
            name
            target{
              ...on Commit{
                treeUrl
                author{
                  name
                }
                authoredDate
                repository{
                  name
                }
              }
            }
          }
        }
      }

    }`);

    const commitShouldBeAdd = (node) => {
      if (node.name === "master") return false;
      const dateNode = new Date(node.target.authoredDate);
      return (
        dateNode.getTime() - oneWeekAgo.getTime() > 0 &&
        node.target.author.name == login
      );
    };

    repoResult.repository.refs.nodes.forEach((node) => {
      if (commitShouldBeAdd(node)) {
        console.log(node);
        if (!reposLog[node.target.repository.name]) {
          reposLog[node.target.repository.name] = new RepoLog(
            node.target.repository.name
          );
        }

        const branchUrl = `https://github.com/${owner}/${name}/tree/${node.name}`;

        reposLog[node.target.repository.name].branches.push({
          url: branchUrl,
          title: node.name,
        });
      }
    });

    // question (BAD FORMATTING WHY ???)
    const processIssueQuestion = (issueNodes)=>{
      issueNodes.forEach((issue) => {
          issue.labels.nodes.forEach((label) => {
            if(label.name==="question"){

              if (!reposLog[name]) {
            reposLog[name] = new RepoLog(
              name
            );
          }
          reposLog[name].questions.push({title:issue.title, url:issue.url})
              
            }
          })
      })
    }

    processIssueQuestion(firstIssueResult.repository.issues.nodes)
    

  };

  await repoRequests("VCityTeam", "UD-Imuv");
  await repoRequests("VCityTeam", "UD-Viz-Template");
  await repoRequests("VCityTeam", "UD-Viz");
  await repoRequests("VCityTeam", "Itowns");
  await repoRequests("itowns", "itowns");
  // await repoRequests("VCityTeam", "GALERI3");

  const outputPath = process.argv[2];
  if (!outputPath) throw new Error("need to specify output file");

  let output = "### VMA\n";
  output += "#### Done\n";
  output += "| Tâche | Temps prévu | Temps passé | Commentaire |\n";
  output += "| ----- | ----- | ----- | ----- |\n";
  for (const name in reposLog) {
    output += reposLog[name].toRowMD();
    output += `\n`;
  }
  output += "| Autrechose  | ? | ? | ? |\n";

  fs.writeFileSync(outputPath, output);
};

main();
