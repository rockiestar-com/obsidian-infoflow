import { DateTime } from 'luxon'
import {
  addIcon,
  normalizePath,
  Notice,
  Plugin,
  stringifyYaml,
  TFile,
  TFolder,
} from 'obsidian'
import { deleteInfoFlowItem, fetchInfoFlowData } from './api'
import { DEFAULT_SETTINGS, InfoFlowSettings } from './settings'
import {
  preParseTemplate,
  render,
  renderFilename,
  renderItemContent,
} from './settings/template'
import { InfoFlowSettingTab } from './settingsTab'
import {
  DATE_FORMAT,
  findFrontMatterIndex,
  parseDateTime,
  parseFrontMatterFromContent,
  removeFrontMatterFromContent,
  replaceIllegalCharsFile,
  replaceIllegalCharsFolder,
  setOrUpdateHighlightColors,
} from './util'

export default class InfoFlowPlugin extends Plugin {
  settings: InfoFlowSettings

  async onload() {
    await this.loadSettings()
    await this.resetSyncingStateSetting()

    // update version if needed
    const latestVersion = this.manifest.version
    const currentVersion = this.settings.version
    if (latestVersion !== currentVersion) {
      this.settings.version = latestVersion
      await this.saveSettings()
      // show release notes
      const releaseNotes = `InfoFlow plugin is upgraded to ${latestVersion}.
    
    What's new: https://github.com/omnivore-app/obsidian-omnivore/blob/main/CHANGELOG.md
    `
      new Notice(releaseNotes, 10000)
    }

    this.addCommand({
      id: 'sync',
      name: 'Sync new changes',
      callback: async () => {
        await this.fetchInfoFlow()
      },
    })

    this.addCommand({
      id: 'deleteArticle',
      name: 'Delete Current Article from InfoFlow',
      callback: async () => {
        await this.deleteCurrentItem(this.app.workspace.getActiveFile())
      },
    })

    this.addCommand({
      id: 'resync',
      name: 'Resync all articles',
      callback: async () => {
        this.settings.syncAt = ''
        await this.saveSettings()
        new Notice('InfoFlow Last Sync reset')
        await this.fetchInfoFlow()
      },
    })

    const iconId = 'InfoFlow'
    // add icon
    addIcon(
      iconId,
      `<svg width="40" height="40" viewBox="0 0 40 40" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M13.3359 38C13.3074 37.9919 13.2851 37.9778 13.2623 37.9768C13.0401 37.9671 12.8164 37.972 12.5957 37.9489C12.2318 37.9107 11.8658 37.8746 11.5081 37.8013C11.1076 37.7193 10.7057 37.6238 10.3219 37.4856C9.80668 37.3001 9.31633 37.0526 8.87333 36.7228C8.53402 36.4702 8.22415 36.1871 7.97162 35.8453C7.88281 35.7251 7.79503 35.6041 7.7065 35.4837C7.66009 35.4206 7.67095 35.3808 7.74648 35.3483C7.85259 35.3027 7.95413 35.2465 8.05787 35.1953C8.26402 35.0936 8.25139 35.1067 8.41811 35.2698C8.6189 35.4663 8.83075 35.6572 9.06175 35.8157C9.40637 36.0521 9.7586 36.2847 10.1318 36.4701C10.6308 36.718 11.1565 36.9045 11.7087 37.0124C12.0459 37.0782 12.3808 37.1457 12.7253 37.154C12.992 37.1605 13.2601 37.1915 13.5249 37.1733C14.0245 37.1389 14.5183 37.0642 15.0033 36.9241C15.4909 36.7833 15.9553 36.5899 16.3942 36.3427C16.7206 36.1588 17.0335 35.9459 17.3319 35.719C17.5887 35.5237 17.8282 35.3017 18.0548 35.0712C18.4262 34.6934 18.7387 34.2682 19.0136 33.814C19.3039 33.3343 19.5177 32.8216 19.6774 32.2879C19.7747 31.9629 19.843 31.628 19.9032 31.2937C19.9592 30.9828 19.9915 30.6673 20.0259 30.3529C20.0498 30.1348 20.0632 29.9153 20.0748 29.6961C20.0872 29.4619 20.0924 29.2274 20.0998 28.9929C20.1085 28.7182 20.1229 28.4435 20.1231 28.1688C20.1249 25.6785 20.1262 23.1882 20.123 20.6979C20.1219 19.8107 20.1071 18.9235 20.1009 18.0363C20.0998 17.888 19.9624 17.7386 19.7531 17.6675C19.5235 17.5895 19.2897 17.5488 19.0417 17.5892C18.8297 17.6237 18.61 17.6108 18.398 17.6451C18.1488 17.6855 17.9007 17.7421 17.6583 17.8131C17.1124 17.9728 16.5966 18.2087 16.1363 18.5411C15.8137 18.7742 15.5096 19.0395 15.2298 19.3226C15.1051 19.4487 15.1187 19.3426 15.0864 19.2878C14.9986 19.1392 14.9145 18.9884 14.8292 18.8384C14.7929 18.7746 14.8064 18.7269 14.8651 18.6794C15.2218 18.3907 15.5686 18.0892 15.9332 17.8111C16.3625 17.4835 16.8311 17.2149 17.3172 16.9809C17.9582 16.6723 18.6203 16.4184 19.3169 16.2641C19.5616 16.2099 19.8088 16.1675 20.0541 16.116C20.0725 16.1122 20.0982 16.079 20.098 16.0598C20.0925 15.644 20.0827 15.2283 20.0761 14.8125C20.0669 14.2356 20.0529 13.6586 20.0543 13.0817C20.0551 12.77 20.0752 12.4577 20.1023 12.147C20.1325 11.8001 20.173 11.4537 20.2229 11.1091C20.2786 10.7235 20.3296 10.3354 20.4197 9.95716C20.5209 9.53174 20.6468 9.11031 20.7918 8.69762C21.0144 8.06407 21.3192 7.469 21.6829 6.90245C21.9414 6.49966 22.2221 6.1158 22.5409 5.75968C22.7282 5.55037 22.9092 5.33331 23.1141 5.14232C23.4956 4.78678 23.893 4.45062 24.3174 4.14332C24.882 3.73448 25.4796 3.38521 26.1082 3.0926C26.7144 2.81037 27.3424 2.57637 27.9989 2.43466C28.3818 2.35203 28.767 2.27741 29.1541 2.21869C29.4315 2.17661 29.7135 2.1622 29.994 2.14411C30.228 2.12903 30.4636 2.11042 30.6969 2.12233C31.0349 2.13959 31.3716 2.18237 31.7088 2.21542C31.9447 2.23853 32.1806 2.26194 32.4161 2.28818C32.6891 2.31858 32.9611 2.37043 33.2346 2.37981C33.5691 2.39129 33.9047 2.3679 34.2399 2.36042C34.5328 2.35388 34.8133 2.28615 35.0894 2.1937C35.0993 2.1904 35.1359 2.22551 35.1371 2.24425C35.1488 2.41797 35.144 2.59348 35.1659 2.76569C35.2055 3.0772 35.2407 3.39142 35.3134 3.69604C35.4062 4.08525 35.5198 4.47102 35.6507 4.84922C35.8089 5.30648 36.0004 5.75209 36.1668 6.20667C36.3859 6.80528 36.6099 7.40285 36.8019 8.0103C36.9211 8.38705 36.9886 8.78049 37.0727 9.16786C37.2043 9.77333 37.1882 10.3896 37.1631 11.0011C37.1439 11.4668 37.0624 11.9287 36.9596 12.3877C36.8526 12.8657 36.7172 13.3342 36.5344 13.7845C36.2353 14.5215 35.8648 15.2242 35.3677 15.8515C35.1691 16.1021 34.9613 16.3457 34.7527 16.5882C34.3304 17.0792 33.825 17.4749 33.2896 17.8322C32.8243 18.1426 32.3291 18.3989 31.7998 18.5832C31.4367 18.7095 31.0738 18.8397 30.7032 18.9402C30.4068 19.0207 30.1001 19.0664 29.7959 19.1144C29.4385 19.1708 29.0789 19.2147 28.7199 19.2604C28.6071 19.2747 28.493 19.2831 28.3794 19.2846C27.6413 19.2944 26.9032 19.3039 26.1651 19.3083C25.9549 19.3095 25.7445 19.295 25.5344 19.2852C25.2186 19.2704 24.903 19.2538 24.5874 19.2363C24.5621 19.2349 24.538 19.2163 24.5126 19.214C24.4545 19.2086 24.4068 19.2088 24.4019 19.2945C24.3824 19.6353 24.3535 19.9756 24.332 20.3163C24.3198 20.5102 24.3113 20.7044 24.3078 20.8986C24.2977 21.4715 24.2866 22.0444 24.2846 22.6173C24.2834 22.9524 24.2983 23.2876 24.3073 23.6228C24.3143 23.8814 24.3238 24.1399 24.3311 24.3985C24.3398 24.7014 24.3495 25.0043 24.355 25.3073C24.3647 25.8439 24.3793 26.3806 24.3769 26.9171C24.3754 27.2651 24.3542 27.6135 24.3293 27.9608C24.3065 28.2786 24.2789 28.5969 24.2319 28.9118C24.1453 29.493 24.0382 30.0694 23.8789 30.6379C23.7007 31.274 23.4695 31.8872 23.1667 32.4708C22.9241 32.9384 22.6444 33.3873 22.3075 33.7952C22.0899 34.0586 21.861 34.313 21.633 34.5678C21.3235 34.9137 20.9696 35.2105 20.608 35.5004C20.0818 35.9223 19.5171 36.2822 18.9224 36.5982C18.4441 36.8523 17.9541 37.081 17.439 37.2483C16.9374 37.4112 16.4333 37.5686 15.9241 37.7051C15.645 37.7799 15.354 37.8142 15.0665 37.8529C14.7587 37.8943 14.4492 37.9252 14.1395 37.9499C13.8784 37.9706 13.6159 37.9758 13.3541 37.994C13.3541 38 13.342 38 13.3359 38ZM32.1532 17.5205C32.28 17.4479 32.4148 17.3863 32.5324 17.3009C32.927 17.0141 33.3366 16.7429 33.7012 16.4212C34.2517 15.9355 34.7265 15.3773 35.1178 14.7511C35.4202 14.2672 35.6713 13.7587 35.8629 13.2222C35.9961 12.8493 36.1081 12.4697 36.1558 12.0738C36.1908 11.7836 36.2573 11.4955 36.2701 11.2047C36.2856 10.8505 36.2694 10.4938 36.2483 10.1393C36.2322 9.8696 36.2023 9.5987 36.1509 9.33369C36.0865 9.00125 35.9992 8.67286 35.9122 8.34526C35.7579 7.76412 35.5026 7.22397 35.2097 6.70255C34.9543 6.24796 34.6562 5.81943 34.3036 5.4349C34.0745 5.18514 33.8226 4.95565 33.5732 4.72541C33.2177 4.3972 32.8151 4.13344 32.3903 3.90479C31.9044 3.64319 31.3964 3.44298 30.8538 3.32184C30.4887 3.24033 30.1216 3.20865 29.752 3.18469C29.6435 3.17766 29.5331 3.19734 29.4237 3.20681C29.249 3.22195 29.0703 3.2208 28.9005 3.25863C28.5428 3.33833 28.1918 3.43781 27.8514 3.58431C27.3407 3.8041 26.8736 4.08934 26.4619 4.45668C26.2167 4.67541 25.9993 4.9275 25.7848 5.1778C25.3656 5.66694 25.0694 6.23161 24.8421 6.8294C24.5895 7.49389 24.4692 8.19056 24.405 8.89657C24.3815 9.15517 24.3674 9.41484 24.3565 9.67433C24.3438 9.97705 24.3327 10.2801 24.3324 10.583C24.3302 12.4648 24.3313 14.3466 24.3313 16.2285C24.3313 16.8208 24.331 17.4132 24.3314 18.0055C24.3316 18.226 24.3781 18.2963 24.5825 18.3401C24.7181 18.3692 24.8583 18.3805 24.9972 18.3897C25.2965 18.4097 25.5962 18.4243 25.8958 18.4389C26.106 18.449 26.3162 18.4574 26.5265 18.463C26.8938 18.4727 27.2612 18.4846 27.6287 18.4859C27.8872 18.4868 28.1459 18.4725 28.4044 18.4631C28.5704 18.457 28.7368 18.4533 28.902 18.438C29.1993 18.4103 29.4985 18.3893 29.7922 18.3385C30.0965 18.286 30.3977 18.2104 30.6959 18.1289C31.2018 17.9906 31.677 17.7742 32.1532 17.5205Z" fill="black"/><path d="M5.81023 16.1664C5.81023 13.62 5.81309 11.0856 5.80919 8.55126C5.80676 6.97514 5.8009 5.39896 5.78148 3.82299C5.77636 3.40794 5.57591 3.09385 5.05592 2.9177C4.76363 2.81869 4.45925 2.7873 4.15157 2.79716C4.08302 2.79936 4.07566 2.77877 4.06576 2.714C4.03121 2.48785 4.06705 2.27002 4.11973 2.05292C4.12504 2.03099 4.15862 1.99973 4.17872 2C4.53 2.00474 4.88125 2.01237 5.23243 2.02244C5.37426 2.0265 5.51578 2.042 5.6576 2.0452C6.10549 2.05532 6.55342 2.06544 7.00139 2.06948C8.11815 2.07955 9.23493 2.08877 10.3517 2.09285C10.7069 2.09415 11.0623 2.07954 11.4175 2.06951C11.5714 2.06517 11.725 2.05253 11.8789 2.04751C11.9028 2.04673 11.9426 2.06064 11.9494 2.07787C12.0372 2.30031 12.1179 2.52246 11.9796 2.75811C11.9186 2.86199 11.835 2.91713 11.7196 2.91521C11.4154 2.91016 11.1155 2.93395 10.827 3.0377C10.3643 3.2041 10.0413 3.50549 9.92233 3.99568C9.90234 4.07809 9.89749 4.16588 9.89747 4.25118C9.89638 10.9074 9.89716 17.5637 9.89492 24.2199C9.89477 24.6623 10.0892 24.8574 10.4593 24.9889C10.8093 25.1131 11.1693 25.2057 11.5427 25.234C11.7215 25.2475 11.8999 25.2673 12.0788 25.2813C12.1791 25.2891 12.2953 25.4494 12.2639 25.5587C12.2328 25.6669 12.2132 25.8043 12.1374 25.8678C12.0113 25.9734 11.8531 26.0545 11.6746 26.0553C11.4234 26.0565 11.1721 26.0588 10.921 26.0547C10.6664 26.0507 10.412 26.038 10.1574 26.0318C9.77394 26.0224 9.39045 26.0156 9.00699 26.0072C8.65575 25.9995 8.3045 25.9834 7.9533 25.9847C7.23943 25.9873 6.52556 25.998 5.81173 26.0077C5.42017 26.0131 5.02864 26.022 4.63717 26.032C4.46313 26.0365 4.28862 26.0411 4.11558 26.0583C4.02896 26.0669 3.998 26.0153 4.0001 25.9596C4.00806 25.7484 4.02634 25.5374 4.04867 25.3271C4.0514 25.3014 4.10149 25.2614 4.1304 25.2607C4.45106 25.2531 4.76196 25.1985 5.0636 25.0887C5.40848 24.9633 5.64985 24.736 5.75475 24.3797C5.77845 24.2992 5.78452 24.2111 5.78477 24.1264C5.78698 23.373 5.78382 22.6195 5.7865 21.8661C5.79323 19.9702 5.80217 18.0744 5.81023 16.1664Z" fill="black"/></svg>`,
    )

    // This creates an icon in the left ribbon.
    this.addRibbonIcon(iconId, iconId, async (evt: MouseEvent) => {
      // Called when the user clicks the icon.
      await this.fetchInfoFlow()
    })

    // This adds a settings tab so the user can configure various aspects of the plugin
    this.addSettingTab(new InfoFlowSettingTab(this.app, this))

    this.scheduleSync()

    // sync when the app is loaded if syncOnStart is true
    if (this.settings.syncOnStart) {
      await this.fetchInfoFlow(false)
    }
  }

  onunload() {}

  async loadSettings() {
    this.settings = Object.assign({}, DEFAULT_SETTINGS, await this.loadData())

    // for backward compatibility, replace advanced filter with all filter
    if (this.settings.filter === 'ADVANCED') {
      this.settings.filter = 'ALL'
      console.log(
        'obsidian-infoflow: advanced filter is replaced with all filter',
      )

      this.saveSettings()
    }

    // initialize css highlight color variables
    setOrUpdateHighlightColors(this.settings.highlightColorMapping)
  }

  async saveSettings() {
    await this.saveData(this.settings)
  }

  async scheduleSync() {
    // clear previous interval
    if (this.settings.intervalId > 0) {
      window.clearInterval(this.settings.intervalId)
    }
    const frequency = this.settings.frequency
    if (frequency > 0) {
      // schedule new interval
      const intervalId = window.setInterval(
        async () => {
          await this.fetchInfoFlow(false)
        },
        frequency * 60 * 1000,
      )
      // save new interval id
      this.settings.intervalId = intervalId
      await this.saveSettings()
      // clear interval when plugin is unloaded
      this.registerInterval(intervalId)
    }
  }

  // async downloadFileAsAttachment(item: Item): Promise<string> {
  //   // download pdf from the URL to the attachment folder
  //   const url = item.url
  //   const response = await requestUrl({
  //     url,
  //     contentType: 'application/pdf',
  //   })
  //   const folderName = normalizePath(
  //     render(
  //       item,
  //       this.settings.attachmentFolder,
  //       this.settings.folderDateFormat,
  //     ),
  //   )
  //   const folder = this.app.vault.getAbstractFileByPath(folderName)
  //   if (!(folder instanceof TFolder)) {
  //     await this.app.vault.createFolder(folderName)
  //   }
  //   const fileName = normalizePath(`${folderName}/${item.id}.pdf`)
  //   const file = this.app.vault.getAbstractFileByPath(fileName)
  //   if (!(file instanceof TFile)) {
  //     const newFile = await this.app.vault.createBinary(
  //       fileName,
  //       response.arrayBuffer,
  //     )
  //     return newFile.path
  //   }
  //   return file.path
  // }

  async fetchInfoFlow(manualSync = true) {
    const {
      syncAt,
      apiKey,
      // highlightOrder,
      syncing,
      template,
      folder,
      filename,
      isSingleFile,
      frontMatterVariables,
      frontMatterTemplate,
    } = this.settings

    if (syncing) {
      new Notice('🐢 Already syncing ...')
      return
    }

    if (!apiKey) {
      new Notice('Missing InfoFlow api key')
      return
    }

    this.settings.syncing = true
    await this.saveSettings()

    try {
      console.log(`obsidian-infoflow starting sync since: '${syncAt}'`)

      manualSync && new Notice('🚀 Fetching items ...')

      // pre-parse template
      frontMatterTemplate && preParseTemplate(frontMatterTemplate)

      const size = 15
      for (let offset = 0; ; offset += size) {
        const [items, hasNextPage] = await fetchInfoFlowData(
          this.settings.endpoint,
          apiKey,
          {
            offset,
            lastSync: parseDateTime(syncAt).toISO() || undefined,
            size,
          },
        )

        for (const item of items) {
          const folderName = replaceIllegalCharsFolder(
            normalizePath(render(item, folder, this.settings.folderDateFormat)),
          )
          const infoFlowFolder =
            this.app.vault.getAbstractFileByPath(folderName)
          if (!(infoFlowFolder instanceof TFolder)) {
            await this.app.vault.createFolder(folderName)
          }
          // const fileAttachment =
          //   item.pageType === 'FILE' && includeFileAttachment
          //     ? await this.downloadFileAsAttachment(item)
          //     : undefined
          const content = await renderItemContent(
            item,
            template,
            // highlightOrder,
            this.settings.enableHighlightColorRender
              ? this.settings.highlightManagerId
              : undefined,
            this.settings.dateHighlightedFormat,
            this.settings.dateSavedFormat,
            isSingleFile,
            frontMatterVariables,
            frontMatterTemplate,
          )
          // use the custom filename
          const customFilename = replaceIllegalCharsFile(
            renderFilename(item, filename, this.settings.filenameDateFormat),
          )
          const pageName = `${folderName}/${customFilename}.md`
          const normalizedPath = normalizePath(pageName)
          const infoFlowFile =
            this.app.vault.getAbstractFileByPath(normalizedPath)
          if (infoFlowFile instanceof TFile) {
            // file exists, so we might need to update it
            if (isSingleFile) {
              // sync into a single file
              const existingContent = await this.app.vault.read(infoFlowFile)
              // we need to remove the front matter
              const contentWithoutFrontmatter =
                removeFrontMatterFromContent(content)
              const existingContentWithoutFrontmatter =
                removeFrontMatterFromContent(existingContent)
              // get front matter from content
              let existingFrontMatter =
                parseFrontMatterFromContent(existingContent) || []
              if (!Array.isArray(existingFrontMatter)) {
                // convert front matter to array
                existingFrontMatter = [existingFrontMatter]
              }
              const newFrontMatter = parseFrontMatterFromContent(content)
              if (
                !newFrontMatter ||
                !Array.isArray(newFrontMatter) ||
                newFrontMatter.length === 0
              ) {
                throw new Error('Front matter does not exist in the template')
              }
              let newContentWithoutFrontMatter: string

              // find the front matter with the same id
              const frontMatterIdx = findFrontMatterIndex(
                existingFrontMatter,
                item.id,
              )
              if (frontMatterIdx >= 0) {
                // this article already exists in the file
                // we need to locate the article which is wrapped in comments
                // and replace the content
                const sectionStart = `%%${item.id}_start%%`
                const sectionEnd = `%%${item.id}_end%%`
                const existingContentRegex = new RegExp(
                  `${sectionStart}.*?${sectionEnd}`,
                  's',
                )
                newContentWithoutFrontMatter =
                  existingContentWithoutFrontmatter.replace(
                    existingContentRegex,
                    contentWithoutFrontmatter,
                  )

                existingFrontMatter[frontMatterIdx] = newFrontMatter[0]
              } else {
                // this article doesn't exist in the file
                // prepend the article
                newContentWithoutFrontMatter = `${contentWithoutFrontmatter}\n\n${existingContentWithoutFrontmatter}`
                // prepend new front matter which is an array
                existingFrontMatter.unshift(newFrontMatter[0])
              }

              const newFrontMatterStr = `---\n${stringifyYaml(
                existingFrontMatter,
              )}---`

              await this.app.vault.modify(
                infoFlowFile,
                `${newFrontMatterStr}\n\n${newContentWithoutFrontMatter}`,
              )
              continue
            }
            // sync into separate files
            await this.app.fileManager.processFrontMatter(
              infoFlowFile,
              async (frontMatter) => {
                const id = frontMatter.id
                if (id && id !== item.id) {
                  // this article has the same name but different id
                  const newPageName = `${folderName}/${customFilename}-${item.id}.md`
                  const newNormalizedPath = normalizePath(newPageName)
                  const newInfoFlowFile =
                    this.app.vault.getAbstractFileByPath(newNormalizedPath)
                  if (newInfoFlowFile instanceof TFile) {
                    // a file with the same name and id already exists, so we need to update it
                    const existingContent =
                      await this.app.vault.read(newInfoFlowFile)
                    if (existingContent !== content) {
                      await this.app.vault.modify(newInfoFlowFile, content)
                    }
                    return
                  }
                  // a file with the same name but different id already exists, so we need to create it
                  await this.app.vault.create(newNormalizedPath, content)
                  return
                }
                // a file with the same id already exists, so we might need to update it
                const existingContent = await this.app.vault.read(infoFlowFile)
                if (existingContent !== content) {
                  await this.app.vault.modify(infoFlowFile, content)
                }
              },
            )
            continue
          }
          // file doesn't exist, so we need to create it
          try {
            await this.app.vault.create(normalizedPath, content)
          } catch (error) {
            if (error.toString().includes('File already exists')) {
              new Notice(
                `Skipping file creation: ${normalizedPath}. Please check if you have duplicated article titles and delete the file if needed.`,
              )
            } else {
              throw error
            }
          }
        }

        this.settings.syncAt = DateTime.local().toFormat(DATE_FORMAT)

        if (!hasNextPage) {
          break
        }
      }

      console.log('obsidian-infoflow sync completed', this.settings.syncAt)
      manualSync && new Notice('🎉 Sync completed')
    } catch (e) {
      new Notice('Failed to fetch items')
      console.error(e)
    } finally {
      this.settings.syncing = false
      await this.saveSettings()
    }
  }

  private async deleteCurrentItem(file: TFile | null) {
    if (!file) {
      return
    }
    //use frontmatter id to find the file
    const itemId = this.app.metadataCache.getFileCache(file)?.frontmatter?.id
    if (!itemId) {
      new Notice('Failed to delete article: article id not found')
    }

    try {
      const isDeleted = deleteInfoFlowItem(
        this.settings.endpoint,
        this.settings.apiKey,
        itemId,
      )
      if (!isDeleted) {
        new Notice('Failed to delete article in InfoFlow')
      }
    } catch (e) {
      new Notice('Failed to delete article in InfoFlow')
      console.error(e)
    }

    await this.app.vault.delete(file)
  }

  private async resetSyncingStateSetting() {
    this.settings.syncing = false
    this.settings.intervalId = 0
    await this.saveSettings()
  }
}
