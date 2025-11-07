
export const tinymceConfig = {
  init: {
    license_key: 'gpl',
    base_url: '/tinymce',
    suffix: '.min', // используем .min.js файлы
    height: 500,
    menubar: true,
    menu: {
      file: { title: 'File', items: 'newdocument restoredraft | preview | print' },
      edit: { title: 'Edit', items: 'undo redo | cut copy paste | selectall | searchreplace' },
      view: { title: 'View', items: 'code | visualaid visualchars visualblocks | spellchecker | preview fullscreen' },
      insert: { title: 'Insert', items: 'image link media template codesample inserttable | charmap emoticons hr | pagebreak nonbreaking anchor toc | insertdatetime' },
      format: { title: 'Format', items: 'bold italic underline strikethrough superscript subscript codeformat | formats blockformats fontformats fontsizes align lineheight | forecolor backcolor | removeformat' },
      tools: { title: 'Tools', items: 'spellchecker spellcheckerlanguage | code wordcount' },
      table: { title: 'Table', items: 'inserttable | cell row column | tableprops deletetable' },
      help: { title: 'Help', items: 'help' }
    },
    plugins: [
      'advlist', 'autolink', 'lists', 'link', 'image', 'charmap', 'preview', 'anchor',
      'searchreplace', 'visualblocks', 'code', 'fullscreen', 'media',
      'insertdatetime', 'table', 'code', 'help', 'wordcount',
      'quickbars', 'emoticons', 'codesample',
    ],
    toolbar: [
      '  undo redo | formatselect | bold italic backcolor | alignleft aligncenter alignright alignjustify | bullist numlist outdent indent | removeformat | image | code | help'
    ].join(' | '),

    toolbar_mode: 'sliding',
    relative_urls: false,
    remove_script_host: false,
    convert_urls: false,
    branding: false,
    promotion: false,
    resize: true,
    elementpath: true,
    content_langs: [
      { title: 'Russian', code: 'ru' },
      { title: 'English', code: 'en' }
    ],
    language: 'ru',
    promotion: false, // Отключает рекламу TinyMCE
    branding: false, // Убирает брендинг TinyMCE

    paste_data_images: true,
    directionality: 'ltr'
  }
};