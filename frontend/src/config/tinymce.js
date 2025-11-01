
// config/tinymce.js
const handleImageUpload = (blobInfo, progress) => {
  return new Promise((resolve, reject) => {
    const formData = new FormData();
    formData.append('file', blobInfo.blob(), blobInfo.filename());

    axios.post('/api/articles/tinymce/upload', formData, {
      headers: {
        'Content-Type': 'multipart/form-data',
        'Authorization': `Bearer ${localStorage.getItem('token')}`
      },
      onUploadProgress: (progressEvent) => {
        if (progressEvent.lengthComputable) {
          progress(progressEvent.loaded / progressEvent.total * 100);
        }
      }
    })
      .then(response => {
        if (response.data.location) {
          resolve(response.data.location);
        } else {
          reject('Не удалось загрузить изображение');
        }
      })
      .catch(error => {
        console.error('Ошибка загрузки изображения:', error);
        reject('Ошибка загрузки изображения: ' + error.message);
      });
  });
};

export const tinymceConfig = {
  apiKey: '7ewlpjwovz8wf3w9u6txlqoju1fcwfxf4a06sycl2h7fql5g', // Замените на ваш реальный ключ
  init: {
    height: 500,
    menubar: 'file edit view insert format tools table help',
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
      'quickbars', 'emoticons', 'codesample'
    ],
    toolbar: [
      'undo redo | formatselect | bold italic underline forecolor backcolor | alignleft aligncenter alignright alignjustify | bullist numlist outdent indent | link image media table | code fullscreen'
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
    paste_data_images: true,
    directionality: 'ltr'
  }
};