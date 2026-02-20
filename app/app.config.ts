export default defineAppConfig({
  ui: {
    colors: {
      primary: 'green',
      neutral: 'zinc'
    },
    button: {
      defaultVariants: {
        size: 'md'
      }
    },
    input: {
      defaultVariants: {
        size: 'md'
      }
    },
    card: {
      slots: {
        root: 'ring-1 ring-zinc-200 dark:ring-zinc-800 shadow-sm'
      }
    },
    slideover: {
      variants: {
        side: {
          right: {
            content: 'max-w-none sm:w-[680px] lg:w-[860px] xl:w-[960px]'
          }
        }
      }
    }
  }
})
