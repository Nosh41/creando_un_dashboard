//inicio de la función que construye el DataTable
function table() {
    $(document).ready(function($) {
        $('#example').DataTable({
            //resaltando los valores de la columna %_respuesta
            "createdRow": function(row, data, index) {

                $("td", row).eq(3).addClass('highlight');

            },
            info: true,
            paging: true,
            order: [
                [0, 'asc']
            ],
            "language": {
                "url": "//cdn.datatables.net/plug-ins/9dcbecd42ad/i18n/Spanish.json"
            },
            //conectando los datos al archivo productos.json
            columns: [
                { id: "Country", data: "Country", visible: false },
                { id: "Country Code", data: "Country Code" },
                { id: "Continent", data: "Continent" },
                { id: "Region", data: "Region" },
                { id: "Year", data: "Year" },
                { id: "Emissions Per Capita", data: "Emissions Per Capita" },
                { id: "Emissions", data: "Emissions" },
            ],
            columnDefs: [
                { targets: 0 },
                { targets: 1 },
                { targets: 2 },
                { targets: 3 },
                { targets: 4 },
                { targets: 5 },
                { targets: 6 },
            ],
            ajax: {
                url: "https://raw.githubusercontent.com/Nosh41/creando_un_dashboard/gh-pages/all_data.json"
            },
            drawCallback: function(settings) {
                var api = this.api();
                var rows = api.rows({ page: 'current' }).nodes();
                var last = null;
                api.column(0, { page: 'current' }).data().each(function(group, i) {
                    if (last !== group) {
                        $(rows).eq(i).before(
                            `<th class="highlight"><td colspan="7">${group}</th></tr>`
                        );
                        last = group;
                    }
                });
            }
        });
    });


}
